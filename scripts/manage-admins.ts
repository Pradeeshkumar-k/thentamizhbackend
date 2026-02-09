import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting admin management...');

  // 1. Add new admin
  const newAdminEmail = 'Thenthuzhinovels@gmail.com';
  const newAdminPassword = 'thenu@123';
  const hashedPassword = await bcrypt.hash(newAdminPassword, 10);

  console.log(`Upserting admin: ${newAdminEmail}`);
  
  const newAdmin = await prisma.user.upsert({
    where: { email: newAdminEmail },
    update: {
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
    create: {
      email: newAdminEmail,
      passwordHash: hashedPassword,
      role: 'ADMIN',
      name: 'Thenthuzhinovels Admin', // Default name
    },
  });

  console.log(`✅ Admin upserted: ${newAdmin.email}`);

  // 2. Remove old admin (Demote to USER)
  // The user request said "remove nivi admin acc", which likely means removing admin privileges.
  // Deleting the account might delete associated data (comments/likes etc), so demoting is safer unless specified otherwise.
  // However, looking at the request "remove nivi admin acc", it could mean DELETE.
  // But usually "remove admin account" means remove the admin access.
  // I will check if the user exists first.
  
  const oldAdminEmail = 'nivinivi344@gmail.Com'; // Using casing from scripts/verify-admins.ts
  
  console.log(`Checking for old admin: ${oldAdminEmail}`);
  const oldAdmin = await prisma.user.findFirst({
      where: {
          email: {
              equals: oldAdminEmail,
              mode: 'insensitive'
          }
      }
  });

  if (oldAdmin) {
      console.log(`Found user: ${oldAdmin.email} with role ${oldAdmin.role}. Demoting to USER...`);
      await prisma.user.update({
          where: { id: oldAdmin.id },
          data: { role: 'USER' }
      });
      console.log(`✅ User ${oldAdmin.email} demoted to USER.`);
  } else {
      console.log(`⚠️ User ${oldAdminEmail} not found.`);
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
