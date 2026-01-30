// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { PrismaClient } from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

console.log('[(DB-Debug] Initializing Prisma Pool. ConnectionString exists:', !!connectionString);
if (connectionString) {
    console.log('[DB-Debug] Connection string starts with:', connectionString.substring(0, 15) + '...');
}

// Configure pool with SSL settings for Supabase
const pool = new Pool({
  connectionString,
  max: 20, // Increased from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
