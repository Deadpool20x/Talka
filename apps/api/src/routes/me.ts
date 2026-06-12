import { Router } from 'express';
import { prisma } from '@/config/database';
import { NotFoundError, ValidationError } from '@/utils/errors';
import { validateBody } from '@/middleware/validate';
import { updateProfilePayloadSchema } from '@chat-os/types';

export const meRouter: Router = Router();

meRouter.get('/', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      throw new NotFoundError('User');
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
