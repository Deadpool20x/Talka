import Redis from 'ioredis';
import { env } from './env';

// ---------------------------------------------------------------------------
// Shared pub/sub + standard commands singleton
// ---------------------------------------------------------------------------
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('[Redis] connection error:', err);
});

redis.on('connect', () => {
  console.log('[Redis] connected');
});

// ---------------------------------------------------------------------------
// Factory for worker / blocking connections
// maxRetriesPerRequest: null is required for XREADGROUP BLOCK
// ---------------------------------------------------------------------------
export function getRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  client.on('error', (err) => {
    console.error('[Redis Worker] connection error:', err);
  });

  return client;
}
