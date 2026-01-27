
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
  console.log('--- Fix Admin Email Started ---');

  const correctEmail = 'admin@novel.com';
  const wrongEmail = 'admin@example.com';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Check if user with wrong email exists
  const wrongUser = await prisma.user.findUnique({
    where: { email: wrongEmail }
  });

  // 2. Check if user with correct email exists
  const correctUser = await prisma.user.findUnique({
    where: { email: correctEmail }
  });

  if (wrongUser) {
    if (correctUser) {
      // Both exist? Delete wrong, update correct if needed
      console.log('Both emails exist. Deleting wrong one.');
      
      // Move novels/data from wrong to correct if necessary before deleting?
      // For now, assuming restore script just created fresh data for wrong user.
      await prisma.novel.updateMany({
        where: { authorId: wrongUser.id },
        data: { authorId: correctUser.id }
      });
      
      await prisma.user.delete({ where: { id: wrongUser.id } });
      console.log('Deleted user with wrong email.');
      
      // Ensure password is correct for correctUser
      await prisma.user.update({
        where: { id: correctUser.id },
        data: { passwordHash }
      });
      console.log('Updated password for correct email.');
      
    } else {
      // Only wrong exists. Rename it.
      await prisma.user.update({
        where: { id: wrongUser.id },
        data: { 
          email: correctEmail,
          passwordHash // Ensure password is set correctly too
        }
      });
      console.log(`Renamed ${wrongEmail} to ${correctEmail}`);
    }
  } else {
    // Wrong user doesn't exist
    if (correctUser) {
      console.log('User with correct email already exists. Updating password to be sure.');
      await prisma.user.update({
        where: { id: correctUser.id },
        data: { passwordHash }
      });
    } else {
      console.log('Creating new admin user with correct email.');
      await prisma.user.create({
        data: {
          email: correctEmail,
          username: 'admin',
          name: 'Admin User',
          passwordHash,
          role: 'ADMIN'
        }
      });
    }
  }

  console.log('--- Fix Admin Email Finished ---');
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
