import * as bcrypt from 'bcryptjs';
import prisma from '../src/utils/prisma';

async function createAdminUser() {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@gmail.com' },
    });

    if (existingUser) {
      console.log('❌ User admin@gmail.com already exists!');
      console.log('User details:', {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
        role: existingUser.role,
      });
      return;
    }

    // Hash the password
    const password = 'admin123'; // Change this to your desired password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@gmail.com',
        username: 'admin',
        name: 'Admin User',
        passwordHash: passwordHash,
        role: 'ADMIN',
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('-----------------------------------');
    console.log('Email:', adminUser.email);
    console.log('Password:', password);
    console.log('Username:', adminUser.username);
    console.log('Role:', adminUser.role);
    console.log('-----------------------------------');
    console.log('You can now login with these credentials!');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
