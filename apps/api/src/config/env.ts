import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Render's free PostgreSQL gives "postgres://" while Prisma expects "postgresql://".
  // We accept both and normalise to "postgresql://" before passing to Prisma.
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      { message: 'DATABASE_URL must start with postgresql:// or postgres://' },
    )
    .transform((url) => url.replace(/^postgres:\/\//, 'postgresql://')),
  // Render free Redis uses redis://, paid/TLS uses rediss://
  REDIS_URL: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith('redis://') || url.startsWith('rediss://'),
      { message: 'REDIS_URL must start with redis:// or rediss://' },
    ),
  SUPABASE_URL: z.string().url().startsWith('https://').default('https://placeholder-project.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('placeholder-service-role-key'),
  SUPABASE_JWT_SECRET: z.string().min(1).default('placeholder-jwt-secret-at-least-32-characters-long'),
  RATE_LIMIT_PER_MINUTE: z.string().default('100').transform(Number),
});

const cleanEnv = { ...process.env };
const keysToClean = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET'];
for (const key of keysToClean) {
  if (cleanEnv[key] === 'undefined' || cleanEnv[key] === 'null' || cleanEnv[key] === '') {
    delete cleanEnv[key];
  }
}

export const env = envSchema.parse(cleanEnv);

// Write the normalized DATABASE_URL back to process.env so Prisma (which reads
// directly from process.env.DATABASE_URL) gets the correct postgresql:// scheme.
// Render free PostgreSQL gives postgres:// which Prisma doesn't accept natively.
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^postgres:\/\//, 'postgresql://');
}

