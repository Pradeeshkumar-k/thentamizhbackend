import { PrismaClient } from "@prisma/client"

// Singleton pattern for serverless
const globalForPrisma = global as unknown as { prismaRead: PrismaClient }

export const prismaRead = globalForPrisma.prismaRead || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaRead = prismaRead;
}

export default prismaRead;
