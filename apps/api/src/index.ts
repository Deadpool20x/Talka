import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from '@/config/env';
import { router } from '@/routes/index';
import { healthRouter } from '@/routes/health';
import { errorHandler } from '@/middleware/errorHandler';
import { apiRateLimiter } from '@/middleware/rateLimiter';
import { logger } from '@/utils/logger';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { startMessageWorker } from '@/workers/messageWorker';
import { execSync } from 'child_process';
import path from 'path';

const app = express();
const PORT = env.PORT;

// Security and utility middleware
app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN;
if (corsOriginsEnv) {
  const parsed = corsOriginsEnv.split(',').map((o) => o.trim()).filter(Boolean);
  allowedOrigins.push(...parsed);
}

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
app.use(morgan('dev'));
app.use(express.json());

// Apply rate limiter
app.use(apiRateLimiter);

// Mount routes
// Support both root-level health check for simple uptime queries and /api/v1 structured prefix
app.use('/health', healthRouter);
app.use('/api/v1', router);

// Global Error Handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Chat-OS API listening on port ${PORT}`);

  // Verify DB connectivity and run migrations at startup
  const dbRaw = process.env.DATABASE_URL ?? '';
  const dbScheme = dbRaw.split('://')[0] || 'missing';
  logger.info(`[DB] Using scheme: ${dbScheme}`);

  prisma.$queryRaw`SELECT 1`
    .then(() => {
      logger.info('[DB] Database connection verified ✓');
      
      // Run migrations programmatically
      try {
        logger.info('[DB] Running database migrations...');
        const schemaPath = path.resolve(process.cwd(), 'packages/prisma/schema.prisma');
        logger.info(`[DB] Using schema path: ${schemaPath}`);
        
        execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
          stdio: 'inherit',
          env: { ...process.env },
        });
        logger.info('[DB] Database migrations completed successfully ✓');
      } catch (migrateErr) {
        logger.error('[DB] Database migration FAILED:');
        logger.error(migrateErr instanceof Error ? migrateErr.message : String(migrateErr));
      }
    })
    .catch((err) => {
      logger.error('[DB] Database connection FAILED at startup:');
      logger.error(err instanceof Error ? err.message : String(err));
      // Do NOT exit — keep the server up so /health endpoints remain readable
    });

  // Start Redis Stream worker in-process unless explicitly disabled
  if (process.env.ENABLE_WORKER !== 'false') {
    startMessageWorker().catch((err) => {
      logger.error({ msg: 'Message worker crashed', error: err });
    });
  }
});

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  
  // Close the HTTP server first to stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed.');
    
    try {
      await prisma.$disconnect();
      logger.info('Prisma disconnected.');
    } catch (err) {
      logger.error('Error disconnecting Prisma client:', err);
    }
    
    try {
      await redis.quit();
      logger.info('Redis disconnected.');
    } catch (err) {
      logger.error('Error disconnecting Redis client:', err);
    }
    
    logger.info('Graceful shutdown completed.');
    process.exit(0);
  });
  
  // Timeout fallback to force shutdown
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, force exiting.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
