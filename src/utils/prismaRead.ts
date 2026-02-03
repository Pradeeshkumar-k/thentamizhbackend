import { PrismaClient } from "@prisma/client"

// Pooled connection (PgBouncer)
export const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});
export default prismaRead;
