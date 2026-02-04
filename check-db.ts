
import { prisma } from './src/utils/prisma';

async function main() {
  const novels = await prisma.novel.findMany({
    select: { id: true, title: true, coverImageUrl: true }
  });
  console.log('--- DB Content ---');
  novels.forEach(n => {
      let logCover = n.coverImageUrl;
      if (n.coverImageUrl && n.coverImageUrl.startsWith('data:')) {
          logCover = `Base64 (len=${n.coverImageUrl.length})`;
      }
      console.log(`"${n.title}" -> ${logCover}`);
  });
}
main();
