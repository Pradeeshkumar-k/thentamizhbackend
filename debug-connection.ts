
import dotenv from 'dotenv';
dotenv.config();

console.log('Testing Database Connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Defined (starts with ' + process.env.DATABASE_URL.substring(0, 15) + '...)' : 'Undefined');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function testConnection() {
  try {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ 
      connectionString,
      ssl: { rejectUnauthorized: false } 
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    console.log('Attempting to connect...');
    await prisma.$connect();
    console.log('Successfully connected to the database!');
    
    const count = await prisma.user.count();
    console.log('User count:', count);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
