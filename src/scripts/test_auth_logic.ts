import { login, register } from '../controllers/authController';
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Mock Express Request/Response
const mockRes = () => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
};

async function testAuth() {
  console.log('Testing Auth...');
  // console.log('Prisma Keys:', Object.keys(prisma)); // Often empty for Prisma Client
  console.log('Prisma User Model:', !!prisma.user);
  console.log('Prisma Novel Model:', !!prisma.novel);

  try {
      if (prisma.user) {
          const count = await prisma.user.count();
          console.log('User Count in DB:', count);
      } else {
          console.error('CRITICAL: prisma.user is undefined!');
      }
  } catch (e) {
      console.error('Direct DB verification failed:', e);
      return; 
  }

  // 1. Test Admin Login
  console.log('\n[Test] Admin Login');
  const loginReq = {
    body: {
      email: 'admin@example.com',
      password: 'admin123'
    }
  } as Request;
  const loginRes = mockRes();

  await login(loginReq, loginRes as Response);
  console.log('Status:', loginRes.statusCode);
  if (loginRes.statusCode !== 200) { 
     console.log('Login Failed Code:', loginRes.body?.error?.code || 'N/A');
     console.log('Login Failed Message:', loginRes.body?.error?.message || loginRes.body?.message);
  } else {
     console.log('Login Successful!');
  }

  // 2. Test Register
  console.log('\n[Test] Register New User');
  const regEmail = `test${Date.now()}@example.com`;
  const regReq = {
    body: {
      email: regEmail,
      password: 'password123',
      name: 'Test User',
      username: `user${Date.now()}`
    }
  } as Request;
  const regRes = mockRes();

  await register(regReq, regRes as Response);
  console.log('Status:', regRes.statusCode);
  if (regRes.statusCode !== 201) {
      console.log('Error Code:', regRes.body?.error?.code);
      console.log('Error Message:', regRes.body?.error?.message);
      // console.log('Full Error:', JSON.stringify(regRes.body, null, 2));
  } else {
      console.log('Register Successful:', regRes.body?.user?.email);
  }
}

async function testLogin() {
     // ... separate login test to wrap verify 
     // For now just allow the previous flow but with better logging in the catch
}


testAuth()
  .catch(e => console.error(e))
  .finally(async () => {
      await prisma.$disconnect();
  });
