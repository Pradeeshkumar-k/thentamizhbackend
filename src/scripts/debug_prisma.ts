
import { prisma } from '../utils/prisma';

async function main() {
  console.log('--- Debugging Prisma Connection ---');
  try {
    const url = process.env.DATABASE_URL;
    console.log('DATABASE_URL length:', url ? url.length : 'undefined');
    
    console.log('Attempting raw query...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('Raw query successful.');

    console.log('Attempting to fetch novels...');
    const novels = await prisma.novel.findMany({
      take: 5,
      where: {
        status: 'PUBLISHED',
      },
       select: {
        id: true,
        title: true,
      }
    });
    console.log('Fetched novels count:', novels.length);
    console.log('Sample novel:', novels[0]);

  } catch (error) {
    console.error('ERROR OCCURRED:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
