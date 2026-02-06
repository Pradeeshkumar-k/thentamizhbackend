
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting ActivityLog backfill...');

  // 1. Clear existing logs (optional, but good for clean state)
  await prisma.activityLog.deleteMany({});
  console.log('Cleared existing logs.');

  // 2. Fetch last 20 novels
  const novels = await prisma.novel.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: { author: true }
  });

  console.log(`Found ${novels.length} novels.`);

  // 3. Create log entries
  for (const novel of novels) {
    const action = `New novel "${novel.title}" by ${novel.author.name || 'Unknown'}`;
    await prisma.activityLog.create({
      data: {
        action,
        timestamp: novel.createdAt
      }
    });
  }

  console.log('Backfill complete!');
}

backfill()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
