// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of ownership fields...');

  // 1. Backfill Novels
  // For existing novels, createdById should be the same as authorId
  console.log('Backfilling Novels...');
  const novels = await prisma.novel.findMany({
    where: { createdById: null },
    select: { id: true, authorId: true }
  });

  console.log(`Found ${novels.length} novels to update.`);

  for (const novel of novels) {
    await prisma.novel.update({
      where: { id: novel.id },
      data: { createdById: novel.authorId }
    });
  }
  console.log('Novels updated.');

  // 2. Backfill Chapters
  // For existing chapters, createdById should be the authorId of the parent Novel
  console.log('Backfilling Chapters...');
  const chapters = await prisma.chapter.findMany({
    where: { createdById: null },
    select: { 
        id: true, 
        novel: { select: { authorId: true } } 
    }
  });

  console.log(`Found ${chapters.length} chapters to update.`);

  for (const chapter of chapters) {
    if (chapter.novel?.authorId) {
        await prisma.chapter.update({
            where: { id: chapter.id },
            data: { createdById: chapter.novel.authorId }
        });
    }
  }
  console.log('Chapters updated.');
  
  console.log('Backfill complete.');
}

declare var process: { exit: (code?: number) => void };

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
