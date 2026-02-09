import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const log: string[] = [];
  const logMsg = (msg: string) => {
      console.log(msg);
      log.push(msg);
  };

  logMsg('Verifying admin changes...');

  const newAdminEmail = 'Thenthuzhinovels@gmail.com';
  // Use exact casing from previous script just in case, though I used insensitive search
  const oldAdminEmail = 'nivinivi344@gmail.Com'; 

  const newAdmin = await prisma.user.findFirst({
    where: { email: { equals: newAdminEmail, mode: 'insensitive' } },
  });

  const oldAdmin = await prisma.user.findFirst({
    where: { email: { equals: oldAdminEmail, mode: 'insensitive' } },
  });

  if (newAdmin && newAdmin.role === 'ADMIN') {
    logMsg(`SUCCESS: ${newAdminEmail} is an ADMIN.`);
  } else {
    logMsg(`FAILURE: ${newAdminEmail} is NOT an ADMIN (Role: ${newAdmin?.role}).`);
  }

  if (oldAdmin && oldAdmin.role === 'USER') {
    logMsg(`SUCCESS: ${oldAdminEmail} is now a USER.`);
  } else {
      if (!oldAdmin) {
           logMsg(`SUCCESS: ${oldAdminEmail} was deleted (if that was the goal).`);
      } else {
          logMsg(`FAILURE: ${oldAdminEmail} is still ${oldAdmin.role}.`);
      }
  }
  
  fs.writeFileSync('verification_results.txt', log.join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
