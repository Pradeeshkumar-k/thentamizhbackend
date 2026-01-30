// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { PrismaClient } from '@prisma/client';

// Standard Prisma Client Initialization
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export default prisma;
