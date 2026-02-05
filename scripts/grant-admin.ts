import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const users = [
  {
    name: 'swetha swe',
    email: 'Saraswathikarthik9498@gmail.com',
    password: 'saras949811',
    role: 'ADMIN' as const,
  },
  {
    name: 'Thenmozhi',
    email: 'nivinivi344@gmail.Com',
    password: 'nivi@123',
    role: 'ADMIN' as const,
  },
  {
    name: 'Mohana',
    email: 'mohanaanovels@gmail.com',
    password: 'Mohanapriyakannan33',
    role: 'ADMIN' as const,
  },
];

async function main() {
  console.log('Starting admin grant script...');

  for (const userData of users) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    // Trim whitespace just in case
    const email = userData.email.trim();

    try {
        // Upsert: Create if doesn't exist, update if it does
        // Using email as unique identifier
        const user = await prisma.user.upsert({
            where: { email: email },
            update: {
                role: 'ADMIN',
                passwordHash: hashedPassword,
                // Only update name if not present? Or force update? 
                // User asked to "give admin asses" (access).
                // I'll update password too as they provided it explicitly.
            },
            create: {
                email: email,
                passwordHash: hashedPassword,
                name: userData.name,
                role: 'ADMIN',
                username: email.split('@')[0] + Math.floor(Math.random() * 1000), // Ensure unique username draft
            },
        });
        console.log(`✅ Granted ADMIN to ${user.email} (${user.name})`);
    } catch (e) {
        console.error(`❌ Failed to process ${email}:`, e);
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
