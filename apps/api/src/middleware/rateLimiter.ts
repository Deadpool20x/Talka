import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      },
    });
  },
});
