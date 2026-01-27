
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
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
  console.log('--- Promote Admin User Started ---');

  const email = 'admin@novel.com';

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.error('User not found:', email);
    return;
  }

  console.log(`User found: ${user.email}, Current Role: ${user.role}`);

  if (user.role !== 'ADMIN') {
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' }
    });
    console.log('User promoted to ADMIN:', updatedUser);
  } else {
    console.log('User is already ADMIN.');
  }

  console.log('--- Promote Admin User Finished ---');
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
