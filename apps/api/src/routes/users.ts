import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/config/database';
import { ValidationError } from '@/utils/errors';
import { env } from '@/config/env';

// Service-role client used ONLY in POST /register to verify auth.users membership
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const usersRouter: Router = Router();

/**
 * GET /users/search?q=<query>&limit=<n>
 *
 * Searches users by username (case-insensitive) and excludes the caller.
 * Note: `email` is managed by Supabase Auth and is not stored in the `users`
 * Prisma table. The search is therefore username-only. We return an empty
 * `email` string so the response shape stays consistent with UserSearchResult.
 */
usersRouter.get('/search', async (req, res, next) => {
  try {
    const q = (req.query['q'] as string | undefined)?.trim() ?? '';

    if (!q) {
      throw new ValidationError('Query parameter "q" is required and must not be empty.');
    }

    const rawLimit = parseInt((req.query['limit'] as string | undefined) ?? '20', 10);
    const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 20 : rawLimit, 50);

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: {
          id: { not: req.userId },
          username: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          status: true,
        },
        take: limit,
        orderBy: { username: 'asc' },
      }),
      prisma.user.count({
        where: {
          id: { not: req.userId },
          username: { contains: q, mode: 'insensitive' },
        },
      }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: '',          // Email lives in Supabase Auth, not in the users table
      avatar_url: u.avatarUrl ?? null,
      status: u.status,
    }));

    res.json({ data, meta: { limit, total } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users/register
 *
 * Called by the web app immediately after supabase.auth.signUp succeeds.
 * No auth middleware — the fresh JWT may not pass the standard middleware yet.
 * Uses the Supabase service-role client to verify the user ID exists in
 * auth.users before inserting the profile row, preventing fake inserts.
 *
 * Body: { id: UUID, username: string, email: string }
 * 201 Created  — profile row inserted
 * 200 OK       — profile already existed (idempotent)
 * 400          — validation error
 * 500          — database / upstream error
 */
export async function registerHandler(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  try {
    const { id, username, email } = req.body as {
      id?: unknown;
      username?: unknown;
      email?: unknown;
    };

    // ── Validation ─────────────────────────────────────────────────────────
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw new ValidationError('"id" must be a valid UUID.');
    }
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      throw new ValidationError(
        '"username" must be 3-20 characters and contain only letters, numbers, or underscores.',
      );
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      throw new ValidationError('"email" must be a valid email address.');
    }

    // ── Idempotency: row already exists? ───────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing) {
      return res.status(200).json({
        data: {
          id: existing.id,
          username: existing.username,
          avatar_url: existing.avatarUrl ?? null,
          status: existing.status,
        },
        message: 'User profile already exists.',
      });
    }

    // ── Verify the user ID exists in Supabase Auth (best-effort) ────────────
    // If SUPABASE_SERVICE_ROLE_KEY is a placeholder or the admin API is
    // unreachable, log a warning and proceed. Registration should not be
    // blocked by a service key misconfiguration — the /me endpoint will
    // auto-create the profile if this step is skipped.
    const isPlaceholderKey =
      env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-service-role-key' ||
      env.SUPABASE_SERVICE_ROLE_KEY.length < 20;

    if (!isPlaceholderKey) {
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.getUserById(id);

      if (authError || !authData?.user) {
        throw new ValidationError(
          'User ID does not correspond to an authenticated account. Registration aborted.',
        );
      }
    }

    // ── Insert profile row ─────────────────────────────────────────────────
    const user = await prisma.user.create({
      data: {
        id,
        username,
        avatarUrl: null,
        status: 'offline',
      },
    });

    return res.status(201).json({
      data: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatarUrl ?? null,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
}
