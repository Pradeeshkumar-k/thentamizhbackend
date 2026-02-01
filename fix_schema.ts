import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Starting Manual Schema Fix...");

    // 1. Add deletedAt column if not exists
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Novel" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);`);
        console.log("✅ Added 'deletedAt' column.");
    } catch (e: any) {
        console.log("⚠️ Error adding column (might exist):", e.message);
    }

    // 2. Add DELETED enum value
    try {
        // This often fails if inside a transaction block, but let's try.
        // If 'DELETED' already exists, it might throw, but IF NOT EXISTS handles it in newer PG versions.
        await prisma.$executeRawUnsafe(`ALTER TYPE "NovelStatus" ADD VALUE IF NOT EXISTS 'DELETED';`);
        console.log("✅ Added 'DELETED' to NovelStatus enum.");
    } catch (e: any) {
        console.log("⚠️ Error adding enum value (might exist):", e.message);
    }

    console.log("Manual Fix Complete.");

  } catch (e) {
    console.error("FATAL ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
