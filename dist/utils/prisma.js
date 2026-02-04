"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const globalForPrisma = global;
const url = process.env.DATABASE_URL;
console.log('[PRISMA INIT] DATABASE_URL defined:', !!url);
console.log('[PRISMA INIT] NODE_ENV:', process.env.NODE_ENV);
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        datasources: {
            db: { url },
        },
        // log: ['query', 'info', 'warn', 'error'],
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
