import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
};

const url = process.env.DATABASE_URL;
console.log('[PRISMA INIT] DATABASE_URL defined:', !!url);
console.log('[PRISMA INIT] NODE_ENV:', process.env.NODE_ENV);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url },
    },
    // log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
