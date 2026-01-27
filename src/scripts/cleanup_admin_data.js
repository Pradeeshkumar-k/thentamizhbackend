
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Fix SSL 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.DATABASE_URL;

console.log('Connecting to DB...');

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, 
  },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Cleanup Started ---');

  // 1. Delete Novel "test"
  try {
    const testNovels = await prisma.novel.findMany({
        where: {
          title: { contains: 'test', mode: 'insensitive' }
        }
    });

    console.log(`Found ${testNovels.length} novels matching "test".`);

    for (const novel of testNovels) {
        console.log(`Deleting novel: ${novel.title} (${novel.id})`);
        // Delete related data first
        await prisma.bookmark.deleteMany({ where: { novelId: novel.id } });
        await prisma.novelLike.deleteMany({ where: { novelId: novel.id } });
        
        // Chapters cascade?
        await prisma.novel.delete({ where: { id: novel.id } });
        console.log(`Deleted novel: ${novel.id}`);
    }
  } catch (e) {
    console.error('Error deleting novels:', e);
  }

  // 2. Delete User "Admin User"
  try {
    const adminUsers = await prisma.user.findMany({
        where: {
        OR: [
            { name: { equals: 'Admin User', mode: 'insensitive' } },
            { username: { equals: 'admin', mode: 'insensitive' } },
            { email: { contains: 'admin', mode: 'insensitive' } }
        ]
        }
    });

    console.log(`Found ${adminUsers.length} users matching "Admin User" or similar.`);

    for (const user of adminUsers) {
        console.log(`Deleting user: ${user.name} (${user.email})`);
        
        // Delete their bookmarks/likes/comments first
        await prisma.bookmark.deleteMany({ where: { userId: user.id } });
        await prisma.novelLike.deleteMany({ where: { userId: user.id } });
        await prisma.like.deleteMany({ where: { userId: user.id } });
        await prisma.comment.deleteMany({ where: { userId: user.id } });

        // Delete novels authored by them (if any remain)
        const userNovels = await prisma.novel.findMany({ where: { authorId: user.id } });
        for (const n of userNovels) {
             await prisma.bookmark.deleteMany({ where: { novelId: n.id } });
             await prisma.novelLike.deleteMany({ where: { novelId: n.id } });
             await prisma.novel.delete({ where: { id: n.id } });
        }

        await prisma.user.delete({ where: { id: user.id } });
        console.log(`Deleted user: ${user.id}`);
    }
  } catch (e) {
    console.error('Error deleting users:', e);
  }

  console.log('--- Cleanup Finished ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
