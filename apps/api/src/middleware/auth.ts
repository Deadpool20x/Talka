import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { UnauthorizedError } from '@/utils/errors';
import { createClient } from '@supabase/supabase-js';

// Stub WebSocket globally to bypass Node.js < 22 check for Supabase Realtime client
if (typeof (global as any).WebSocket === 'undefined') {
  (global as any).WebSocket = class {};
}

// Initialize Supabase client for remote token verification fallback
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  aud: string;
  role: string;
  iat: number;
  exp: number;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header.');
    }

    const token = authHeader.slice(7);

    try {
      // Local offline verification
      const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET) as SupabaseJwtPayload;
      req.userId = payload.sub;
      req.userEmail = payload.email;
      return next();
    } catch (localErr) {
      // Fallback to remote Supabase verification
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          throw new UnauthorizedError('Invalid or expired token.');
        }
        req.userId = user.id;
        req.userEmail = user.email!;
        return next();
      } catch (remoteErr) {
        throw new UnauthorizedError('Invalid or expired token.');
      }
    }
  } catch (err) {
    next(err);
  }
}

