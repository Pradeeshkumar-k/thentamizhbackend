import { PrismaClient } from "@prisma/client"

// Singleton pattern for serverless
const globalForPrisma = global as unknown as { prismaWrite: PrismaClient }

export const prismaWrite = globalForPrisma.prismaWrite || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaWrite = prismaWrite;
}

export default prismaWrite;
