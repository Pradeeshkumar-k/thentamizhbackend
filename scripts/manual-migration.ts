
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting manual migration...');

  try {
    // 1. Add SUPER_ADMIN to Role enum
    // This might fail if it already exists, so we catch error or check first.
    // PostgreSQL way to add value to enum
    try {
        await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';`);
        console.log('✅ Added SUPER_ADMIN to Role enum');
    } catch (e: any) {
        if (e.message.includes('already exists')) {
            console.log('ℹ️ SUPER_ADMIN role already exists');
        } else {
            console.log('⚠️ Could not add SUPER_ADMIN role (might already exist or not supported):', e.message);
        }
    }

    // 2. Add createdById to Novel
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Novel" ADD COLUMN "createdById" TEXT;`);
        console.log('✅ Added createdById to Novel');
    } catch (e: any) {
        if (e.message.includes('already exists')) {
             console.log('ℹ️ Novel.createdById already exists');
        } else {
            console.error('❌ Failed to add Novel.createdById:', e.message);
        }
    }

    // 3. Add createdById to Chapter
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Chapter" ADD COLUMN "createdById" TEXT;`);
        console.log('✅ Added createdById to Chapter');
    } catch (e: any) {
        if (e.message.includes('already exists')) {
             console.log('ℹ️ Chapter.createdById already exists');
        } else {
            console.error('❌ Failed to add Chapter.createdById:', e.message);
        }
    }

    // 4. Create Indexes (Optional but good)
    try {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Novel_createdById_idx" ON "Novel"("createdById");`);
        console.log('✅ Added index for Novel.createdById');
    } catch (e: any) {
        console.log('⚠️ Failed to add Novel index:', e.message);
    }

    try {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Chapter_createdById_idx" ON "Chapter"("createdById");`);
        console.log('✅ Added index for Chapter.createdById');
    } catch (e: any) {
        console.log('⚠️ Failed to add Chapter index:', e.message);
    }
    
    // 5. Add Foreign Key Constraints (Optional - Prisma doesn't always need them at DB level if app handles it, but good for integrity)
    // Skipping for now to avoid complexity with existing data or constraint names.
    
    console.log('Manual migration complete.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

declare var process: { exit: (code?: number) => void };

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
