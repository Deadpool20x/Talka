import { Router } from 'express';
import { prisma } from '@/config/database';
import { ValidationError } from '@/utils/errors';
import { validateBody } from '@/middleware/validate';
import { updateProfilePayloadSchema } from '@chat-os/types';

export const meRouter: Router = Router();

meRouter.get('/', async (req, res, next) => {
  try {
    // req.userId is guaranteed by authMiddleware (always a string here).
    const userId = req.userId as string;

    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Auto-create profile if it doesn't exist.
    // This is a safety net for users whose POST /users/register silently failed
    // (e.g. bad service role key during registration) — they are authenticated
    // via Supabase but have no row in the users table yet.
    if (!user) {
      // Derive a safe username from the email prefix or fallback to a UUID slice.
      const emailPrefix = req.userEmail?.split('@')[0] ?? '';
      const safePart = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
      const fallback = `user_${userId.replace(/-/g, '').slice(0, 8)}`;
      const baseUsername = safePart.length >= 3 ? safePart : fallback;

      // Ensure uniqueness by appending a suffix if the base username is taken.
      let username = baseUsername;
      const existing = await prisma.user.findFirst({
        where: { username: { startsWith: baseUsername, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        username = `${baseUsername}_${userId.replace(/-/g, '').slice(0, 6)}`;
      }

      user = await prisma.user.create({
        data: {
          id: userId,
          username,
          avatarUrl: null,
          status: 'offline',
        },
      });
    }

    res.json({
      id: user.id,
      email: req.userEmail,
      username: user.username,
      avatar_url: user.avatarUrl,
      status: user.status,
      last_seen: user.lastSeen,
      created_at: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

meRouter.patch('/', validateBody(updateProfilePayloadSchema), async (req, res, next) => {
  try {
    const { username, avatarUrl } = req.body;

    const updateData: { username?: string; avatarUrl?: string | null } = {};
    if (username !== undefined) updateData.username = username;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('At least one field (username, avatarUrl) is required.');
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
    });

    res.json({
      id: user.id,
      email: req.userEmail,
      username: user.username,
      avatar_url: user.avatarUrl,
      status: user.status,
      last_seen: user.lastSeen,
      created_at: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});
