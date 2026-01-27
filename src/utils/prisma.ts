// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { PrismaClient } from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

// Configure pool with SSL settings for Supabase
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Allow self-signed certificates from Supabase
  },
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
