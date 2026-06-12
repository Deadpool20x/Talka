import { prisma } from '@/config/database';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@/utils/errors';

// ---------------------------------------------------------------------------
// Shared shape helper
// ---------------------------------------------------------------------------

function formatParticipant(p: {
  user: { id: string; username: string; avatarUrl: string | null; status: string };
  role: string;
}) {
  return {
    id: p.user.id,
    username: p.user.username,
    avatar_url: p.user.avatarUrl,
    role: p.role,
    status: p.user.status,
  };
}

function formatConversation(
  conv: {
    id: string;
    type: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
    participants: Array<{
      userId: string;
      role: string;
      user: { id: string; username: string; avatarUrl: string | null; status: string };
    }>;
    messages: Array<{
      id: string;
      content: string;
      senderId: string | null;
      createdAt: Date;
    }>;
  },
  currentUserId: string,
  unreadCount: number,
  includeCurrentUser = false
) {
  const participants = conv.participants
    .filter((p) => includeCurrentUser || p.userId !== currentUserId)
    .map(formatParticipant);

  const lastMessage = conv.messages[0] ?? null;

  return {
    id: conv.id,
    type: conv.type,
    name: conv.name,
    participants,
    last_message: lastMessage
      ? {
          id: lastMessage.id,
          content: lastMessage.content,
          sender_id: lastMessage.senderId,
          created_at: lastMessage.createdAt,
        }
      : null,
    unread_count: unreadCount,
    created_at: conv.createdAt,
    updated_at: conv.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listConversations(
  userId: string,
  limit: number,
  cursor?: string
) {
  const where = {
    deletedAt: null,
    participants: {
      some: { userId, leftAt: null },
    },
    ...(cursor ? { updatedAt: { lt: new Date(cursor) } } : {}),
  };

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit + 1,
    include: {
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, username: true, avatarUrl: true, status: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
    },
  });

  const hasMore = conversations.length > limit;
  const page = hasMore ? conversations.slice(0, limit) : conversations;

  // Fetch unread counts using raw SQL for PostgreSQL array membership check
  const unreadCounts = await Promise.all(
    page.map(async (conv) => {
      const rows = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) FROM messages
        WHERE conversation_id = ${conv.id}::uuid
        AND sender_id != ${userId}::uuid
        AND NOT (${userId}::uuid = ANY(read_by))
      `;
      return Number(rows[0].count);
    })
  );

  const data = page.map((conv, i) =>
    formatConversation(conv, userId, unreadCounts[i])
  );

  return {
    data,
    meta: {
      limit,
      next_cursor: hasMore ? page[page.length - 1].updatedAt.toISOString() : undefined,
      has_more: hasMore,
    },
  };
}

export async function createPrivateConversation(
  userId: string,
  participantId: string
) {
  if (userId === participantId) {
    throw new ValidationError('Cannot create a private conversation with yourself.');
  }

  // Idempotent: find existing private conversation between both users
  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'private',
      deletedAt: null,
      participants: {
        every: {
          leftAt: null,
          userId: { in: [userId, participantId] },
        },
      },
      AND: [
        { participants: { some: { userId, leftAt: null } } },
        { participants: { some: { userId: participantId, leftAt: null } } },
      ],
    },
    include: {
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, username: true, avatarUrl: true, status: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
    },
  });

  if (existing) {
    return { conversation: formatConversation(existing, userId, 0), created: false };
  }

  // Create new private conversation in a transaction
  const conv = await prisma.$transaction(async (tx) => {
    const newConv = await tx.conversation.create({
      data: {
        type: 'private',
        name: null,
        createdBy: userId,
        participants: {
          create: [
            { userId, role: 'member' },
            { userId: participantId, role: 'member' },
          ],
        },
      },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, username: true, avatarUrl: true, status: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true },
        },
      },
    });
    return newConv;
  });

  return { conversation: formatConversation(conv, userId, 0), created: true };
}

export async function createGroupConversation(
  userId: string,
  name: string,
  memberIds: string[]
) {
  const allMemberIds = Array.from(new Set([...memberIds, userId]));

  const conv = await prisma.$transaction(async (tx) => {
    const newConv = await tx.conversation.create({
      data: {
        type: 'group',
        name,
        createdBy: userId,
        participants: {
          create: allMemberIds.map((id) => ({
            userId: id,
            role: id === userId ? 'admin' : 'member',
          })),
        },
      },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, username: true, avatarUrl: true, status: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true },
        },
      },
    });
    return newConv;
  });

  return formatConversation(conv, userId, 0, true);
}

export async function getConversation(userId: string, conversationId: string) {
  const conv = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      deletedAt: null,
      participants: { some: { userId, leftAt: null } },
    },
    include: {
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, username: true, avatarUrl: true, status: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
    },
  });

  if (!conv) throw new NotFoundError('Conversation');

  const [unreadResult] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) FROM messages
    WHERE conversation_id = ${conversationId}::uuid
    AND sender_id != ${userId}::uuid
    AND NOT (${userId}::uuid = ANY(read_by))
  `;

  return formatConversation(conv, userId, Number(unreadResult.count), true);
}

async function requireParticipant(conversationId: string, userId: string) {
  const participant = await prisma.participant.findFirst({
    where: { conversationId, userId, leftAt: null },
  });
  if (!participant) throw new NotFoundError('Conversation');
  return participant;
}

async function requireAdmin(conversationId: string, userId: string) {
  const participant = await requireParticipant(conversationId, userId);
  if (participant.role !== 'admin') throw new ForbiddenError('Only admins can perform this action.');
  return participant;
}

export async function addMembers(
  adminId: string,
  conversationId: string,
  memberIds: string[]
) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null, type: 'group' },
  });
  if (!conv) throw new NotFoundError('Conversation');

  await requireAdmin(conversationId, adminId);

  // Find existing participants (active or left)
  const existing = await prisma.participant.findMany({
    where: { conversationId, userId: { in: memberIds } },
  });

  const existingActive = existing.filter((p) => !p.leftAt).map((p) => p.userId);
  if (existingActive.length > 0) {
    throw new ConflictError(`Users already in group: ${existingActive.join(', ')}`);
  }

  // Re-add left members or create new ones
  await prisma.$transaction(async (tx) => {
    for (const userId of memberIds) {
      const prev = existing.find((p) => p.userId === userId);
      if (prev) {
        await tx.participant.update({ where: { id: prev.id }, data: { leftAt: null, role: 'member' } });
      } else {
        await tx.participant.create({ data: { conversationId, userId, role: 'member' } });
      }
    }
    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  });

  return getConversation(adminId, conversationId);
}

export async function removeMember(
  requesterId: string,
  conversationId: string,
  targetUserId: string
) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null, type: 'group' },
  });
  if (!conv) throw new NotFoundError('Conversation');

  const requester = await requireParticipant(conversationId, requesterId);

  // Self-removal or admin-removal
  if (requesterId !== targetUserId && requester.role !== 'admin') {
    throw new ForbiddenError('Only admins can remove other members.');
  }

  // Prevent removing last admin
  if (requester.role === 'admin' && requesterId === targetUserId) {
    const adminCount = await prisma.participant.count({
      where: { conversationId, role: 'admin', leftAt: null },
    });
    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot remove the last admin. Promote another member first.');
    }
  }

  await prisma.participant.updateMany({
    where: { conversationId, userId: targetUserId, leftAt: null },
    data: { leftAt: new Date() },
  });
}

export async function updateGroup(
  requesterId: string,
  conversationId: string,
  name?: string
) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null, type: 'group' },
  });
  if (!conv) throw new NotFoundError('Conversation');

  await requireAdmin(conversationId, requesterId);

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { ...(name !== undefined ? { name } : {}), updatedAt: new Date() },
    include: {
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, username: true, avatarUrl: true, status: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
    },
  });

  return formatConversation(updated, requesterId, 0, true);
}

export async function deleteConversation(userId: string, conversationId: string) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null },
    include: { participants: { where: { userId, leftAt: null } } },
  });
  if (!conv || conv.participants.length === 0) throw new NotFoundError('Conversation');

  const participant = conv.participants[0];

  if (conv.type === 'private') {
    // Soft-delete for the requesting user only
    await prisma.participant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });
  } else {
    // Group: admin deletes entire group, member just leaves
    if (participant.role === 'admin') {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { deletedAt: new Date() },
      });
    } else {
      await prisma.participant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      });
    }
  }
}
