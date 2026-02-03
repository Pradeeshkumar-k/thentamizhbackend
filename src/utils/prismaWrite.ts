import { PrismaClient } from "@prisma/client"

// Direct connection (Bypass PgBouncer)
export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
})
export default prismaWrite;
