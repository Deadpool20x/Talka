import { PrismaClient } from '../generated/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Render's free PostgreSQL gives `postgres://` but Prisma's query engine requires
// `postgresql://`. Normalise here so this is guaranteed regardless of import order.
const rawDatabaseUrl = process.env.DATABASE_URL ?? '';
const datasourceUrl = rawDatabaseUrl.replace(/^postgres:\/\//, 'postgresql://');

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: datasourceUrl } },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '../generated/client';
