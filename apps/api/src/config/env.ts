import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  REDIS_URL: z.string().url().startsWith('redis://'),
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

