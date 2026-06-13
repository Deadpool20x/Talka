import { Router } from 'express';
import { prisma } from '@/config/database';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chat-os-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Detailed diagnostics endpoint — helps debug env var issues in production.
// Returns sanitized config info (no secrets, only schemes/prefixes).
healthRouter.get('/ready', async (_req, res) => {
  const dbRaw = process.env.DATABASE_URL ?? '';
  const dbScheme = dbRaw.split('://')[0] || 'missing';
  const redisRaw = process.env.REDIS_URL ?? '';
  const redisScheme = redisRaw.split('://')[0] || 'missing';

  let dbConnected = false;
  let dbError = '';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message.slice(0, 120) : 'unknown';
  }

  res.json({
    status: dbConnected ? 'ok' : 'degraded',
    service: 'chat-os-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    db: { scheme: dbScheme, connected: dbConnected, error: dbError || undefined },
    redis: { scheme: redisScheme },
    supabase: { url: (process.env.SUPABASE_URL ?? '').replace(/^(https?:\/\/[^/]{6}).*$/, '$1...') },
  });
});
