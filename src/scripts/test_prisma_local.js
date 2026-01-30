const { PrismaClient } = require('@prisma/client');

async function test() {
    console.log('--- Start Prisma Test ---');
    try {
        const prisma = new PrismaClient();
        console.log('Prisma Client initialized successfully.');
    } catch (e) {
        console.log('--- ERROR START ---');
        console.log(e.name);
        console.log(e.message);
        if (e.stack) {
            e.stack.split('\n').forEach(line => console.log(line));
        }
        console.log('--- ERROR END ---');
    }
}

test();
