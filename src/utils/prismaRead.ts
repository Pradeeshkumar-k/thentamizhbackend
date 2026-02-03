import { PrismaClient } from "@prisma/client"

// Pooled connection (PgBouncer)
export const prismaRead = new PrismaClient()
export default prismaRead;
