
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'thentamizhamuthunovels@gmail.com';
  const password = 'tamil@123';
  const role = 'SUPER_ADMIN';
  const name = 'Thentamizh Super Admin';

  console.log(`Processing user: ${email}...`);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`User ${email} exists. Updating role to ${role} and password...`);
      await prisma.user.update({
        where: { email },
        data: {
          role: role as any, // Cast to any to avoid issue if type isn't fully updated in some context, though it should be fine
          passwordHash: hashedPassword,
        },
      });
      console.log(`✅ User ${email} updated successfully.`);
    } else {
      console.log(`User ${email} not found. Creating new ${role}...`);
      await prisma.user.create({
        data: {
          email,
          username: email.split('@')[0],
          name,
          passwordHash: hashedPassword,
          role: role as any,
        },
      });
      console.log(`✅ User ${email} created successfully.`);
    }
  } catch (error) {
    console.error(`❌ Failed to process user ${email}:`, error);
  }
}

// @ts-ignore
declare var process: { exit: (code?: number) => void };

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
