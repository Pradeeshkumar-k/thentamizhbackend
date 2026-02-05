import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const emails = [
  'Saraswathikarthik9498@gmail.com',
  'nivinivi344@gmail.Com',
  'mohanaanovels@gmail.com',
];

async function main() {
  console.log('Verifying admin access...');
  
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: emails,
        mode: 'insensitive', 
      },
    },
    select: {
      email: true,
      role: true,
      name: true,
    },
  });

  console.table(users);
  
  if (users.length === 3 && users.every(u => u.role === 'ADMIN')) {
      console.log('✅ All 3 users exist and have ADMIN role.');
  } else {
      console.error('❌ Verification failed. Some users missing or not ADMIN.');
      emails.forEach(e => {
          const found = users.find(u => u.email.toLowerCase() === e.toLowerCase());
          if (!found) console.log(`Missing: ${e}`);
          else if (found.role !== 'ADMIN') console.log(`Not Admin: ${e} is ${found.role}`);
      });
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
