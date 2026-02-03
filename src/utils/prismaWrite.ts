import { PrismaClient } from "@prisma/client"

export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
})
