
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Restore Started ---');

  // 1. Restore Admin User
  const email = 'admin@example.com';
  const name = 'Admin User';
  const username = 'admin';
  const password = 'admin123';
  const role = 'ADMIN';

  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log(`Creating user: ${name}`);
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email,
        username,
        name,
        passwordHash,
        role
      }
    });
    console.log(`Created user: ${user.id}`);
  } else {
    console.log(`User already exists: ${user.id}`);
  }

  // 2. Restore Test Novel
  const novelTitle = 'test';
  
  let novel = await prisma.novel.findFirst({
    where: { 
      title: novelTitle,
      authorId: user.id 
    }
  });

  if (!novel) {
    console.log(`Creating novel: ${novelTitle}`);
    novel = await prisma.novel.create({
      data: {
        title: novelTitle,
        description: 'Test novel description',
        genre: 'Test Genre',
        status: 'PUBLISHED',
        authorId: user.id,
        // Optional: Add default cover image if needed or match previous state
        coverImageUrl: '' 
      }
    });
    console.log(`Created novel: ${novel.id}`);
  } else {
     console.log(`Novel already exists: ${novel.id}`);
  }

  console.log('--- Restore Finished ---');
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
