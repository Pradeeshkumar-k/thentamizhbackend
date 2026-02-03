import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
};

const url = 'postgres://postgres:Welcome9952509985@db.aegbvcoffyzrsnxjunxz.supabase.co:5432/postgres?sslmode=require';
console.log('[PRISMA INIT] Using HARDCODED direct URL');

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url },
    },
    log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
