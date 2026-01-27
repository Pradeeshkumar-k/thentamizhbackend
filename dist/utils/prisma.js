"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
// Configure pool with SSL settings for Supabase
const pool = new pg_1.Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false, // Allow self-signed certificates from Supabase
    },
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
exports.default = prisma;
