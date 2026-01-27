// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { PrismaClient, NovelStatus, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      username: 'admin',
      name: 'Admin User',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Created/Updated Admin: ${admin.email}`);

  // 2. Create Novels
  const novels = [
    {
      title: 'ராட்சசனே எனை வதைப்பதேனடா!',
      titleEn: 'Oh Demon! Why Do You Torment Me!',
      description: 'The story revolves around a complex relationship defined by intensity and emotion. Follow the journey of love, conflict, and redemption.',
      descriptionEn: 'The story revolves around a complex relationship defined by intensity and emotion. Follow the journey of love, conflict, and redemption.',
      genre: 'Romance',
      status: NovelStatus.PUBLISHED,
      coverImageUrl: 'Novel Card/Thenmozhi Card.jpg',
      authorId: admin.id,
      views: 0,
    },
    {
      title: 'வந்ததுணையே! என் வாழ்க்கைத் துணையே!',
      titleEn: 'Welcome! My Life Partner!',
      description: 'A beautiful narrative about finding one\'s soulmate in unexpected circumstances. A tale of destiny and companionship.',
      descriptionEn: 'A beautiful narrative about finding one\'s soulmate in unexpected circumstances. A tale of destiny and companionship.',
      genre: 'Family Drama',
      status: NovelStatus.PUBLISHED,
      coverImageUrl: 'Novel Card/Mohana card.jpg',
      authorId: admin.id,
      views: 0,
    }
  ];

  for (const novelData of novels) {
    const existing = await prisma.novel.findFirst({
        where: { title: novelData.title }
    });

    if (!existing) {
        const novel = await prisma.novel.create({
            data: novelData
        });
        console.log(`Created Novel: ${novel.title}`);
    } else {
        console.log(`Novel already exists: ${novelData.title}`);
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Close pool to exit process
  });
