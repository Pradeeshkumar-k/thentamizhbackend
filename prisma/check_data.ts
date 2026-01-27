// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Checking Bookmarks ---');
  const bookmarks = await prisma.bookmark.findMany({
      include: {
          novel: { select: { title: true } },
          user: { select: { email: true } }
      }
  });
  console.log(`Total Bookmarks: ${bookmarks.length}`);
  bookmarks.forEach(b => console.log(`- ${b.user.email} -> ${b.novel.title}`));

  console.log('\n--- Checking Novel Stats ---');
  const novels = await prisma.novel.findMany({
      select: { title: true, _count: { select: { bookmarks: true, likes: true } } }
  });
  novels.forEach(n => console.log(`- ${n.title}: ${n._count.bookmarks} Bookmarks, ${n._count.likes} Likes`));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
  });
