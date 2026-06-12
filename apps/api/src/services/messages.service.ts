import { prisma } from '@/config/database';
import { NotFoundError, ForbiddenError, ValidationError } from '@/utils/errors';

// ---------------------------------------------------------------------------
// Guard: ensure user is an active participant in the conversation
// ---------------------------------------------------------------------------
async function requireActiveParticipant(userId: string, conversationId: string) {
  const participant = await prisma.participant.findFirst({
    where: { conversationId, userId, leftAt: null },
  });
  if (!participant) throw new NotFoundError('Conversation');
  return participant;
}

// ---------------------------------------------------------------------------
// Message shape returned to client (matches REST_API.md §5.1)
// ---------------------------------------------------------------------------
function formatMessage(m: {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  type: string;
  tempId: string | null;
  replyToId: string | null;
  metadata: unknown;
  readBy: string[];
  createdAt: Date;
}) {
  return {
    id: m.id,
    conversation_id: m.conversationId,
    sender_id: m.senderId,
    content: m.content,
    type: m.type,
    temp_id: m.tempId,
    reply_to_id: m.replyToId,
    metadata: m.metadata ?? {},
    read_by: m.readBy,
    created_at: m.createdAt,
  };
}

// ---------------------------------------------------------------------------
// getMessages — cursor-based pagination on createdAt
// ---------------------------------------------------------------------------
export async function getMessages(
  userId: string,
  conversationId: string,
  limit: number,
  cursor?: string,
  direction: 'older' | 'newer' = 'older'
) {
  await requireActiveParticipant(userId, conversationId);

  const cursorDate = cursor ? new Date(cursor) : undefined;
  const isOlder = direction === 'older';

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursorDate
        ? isOlder
          ? { createdAt: { lt: cursorDate } }
          : { createdAt: { gt: cursorDate } }
        : {}),
    },
    orderBy: { createdAt: isOlder ? 'desc' : 'asc' },
    take: limit + 1, // fetch one extra to determine hasMore
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  // Always return in descending order (newest first) per REST_API.md §5.1
  const sorted = isOlder ? page : [...page].reverse();

  return {
    data: sorted.map(formatMessage),
    meta: {
      limit,
      next_cursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : undefined,
      has_more: hasMore,
    },
  };
}

// ---------------------------------------------------------------------------
// createMessage — REST fallback (idempotent via tempId)
// ---------------------------------------------------------------------------
export async function createMessage(
  userId: string,
  conversationId: string,
  content: string,
  type: string,
  tempId: string,
  replyToId?: string | null
) {
  await requireActiveParticipant(userId, conversationId);

  if (content.length > 4000) {
    throw new ValidationError('Content exceeds maximum length of 4000 characters.');
  }

  // Idempotency: return existing message if tempId already used
  const existing = await prisma.message.findUnique({ where: { tempId } });
  if (existing) return formatMessage(existing);

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        type,
        tempId,
        replyToId: replyToId ?? null,
        readBy: [],
      },
    });

    // Touch conversation updatedAt so it appears first in conversation list
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });

  return formatMessage(message);
}

// ---------------------------------------------------------------------------
// markMessageRead — add userId to readBy (skip if sender or already read)
// ---------------------------------------------------------------------------
export async function markMessageRead(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new NotFoundError('Message');

  // Verify the user is a participant in the conversation
  await requireActiveParticipant(userId, message.conversationId);

  // Do not mark as read if the user is the sender
  if (message.senderId === userId) {
    throw new ForbiddenError('Cannot mark your own message as read.');
  }

  // Skip if already in readBy
  if (message.readBy.includes(userId)) return formatMessage(message);

  const updated = await prisma.$executeRaw`
    UPDATE messages
    SET read_by = array_append(read_by, ${userId}::uuid)
    WHERE id = ${messageId}::uuid
      AND NOT (${userId}::uuid = ANY(read_by))
  `;

  if (updated === 0) return formatMessage(message);

  const refreshed = await prisma.message.findUnique({ where: { id: messageId } });
  return formatMessage(refreshed!);
}

// ---------------------------------------------------------------------------
// bulkMarkRead — mark all messages up to anchor as read for userId
// ---------------------------------------------------------------------------
export async function bulkMarkRead(
  userId: string,
  conversationId: string,
  lastMessageId: string
) {
  await requireActiveParticipant(userId, conversationId);

  // Resolve anchor message timestamp
  const anchor = await prisma.message.findUnique({
    where: { id: lastMessageId },
    select: { createdAt: true, conversationId: true },
  });

  if (!anchor) throw new NotFoundError('Message');
  if (anchor.conversationId !== conversationId) throw new NotFoundError('Message');

  // Bulk update using raw SQL for array membership check
  const result = await prisma.$executeRaw`
    UPDATE messages
    SET read_by = array_append(read_by, ${userId}::uuid)
    WHERE conversation_id = ${conversationId}::uuid
      AND created_at <= ${anchor.createdAt}
      AND sender_id != ${userId}::uuid
      AND NOT (${userId}::uuid = ANY(read_by))
  `;

  return { updated_count: Number(result) };
}
