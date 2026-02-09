import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Verifying admin changes...');

  const newAdminEmail = 'Thenthuzhinovels@gmail.com';
  const oldAdminEmail = 'nivinivi344@gmail.Com';

  const newAdmin = await prisma.user.findFirst({
    where: { email: { equals: newAdminEmail, mode: 'insensitive' } },
  });

  const oldAdmin = await prisma.user.findFirst({
    where: { email: { equals: oldAdminEmail, mode: 'insensitive' } },
  });

  if (newAdmin && newAdmin.role === 'ADMIN') {
    console.log(`✅ SUCCESS: ${newAdminEmail} is an ADMIN.`);
  } else {
    console.error(`❌ FAILURE: ${newAdminEmail} is NOT an ADMIN (Role: ${newAdmin?.role}).`);
  }

  if (oldAdmin && oldAdmin.role === 'USER') { // Assuming demotion to USER
    console.log(`✅ SUCCESS: ${oldAdminEmail} is now a USER.`);
  } else {
      // If user was deleted or still admin
      if (!oldAdmin) {
           console.log(`✅ SUCCESS: ${oldAdminEmail} was deleted (if that was the goal).`);
      } else {
          console.error(`❌ FAILURE: ${oldAdminEmail} is still ${oldAdmin.role}.`);
      }
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
