
import prisma from '../utils/prisma';

async function main() {
    console.log("--- SIMPLIFIED PRISMA TEST ---");
    console.log("Imported Prisma Object keys:", Object.keys(prisma));
    
    // Check models (dynamic properties on the instance)
    // Note: In some Prisma versions they are not enumerable, so we access directly.
    console.log("Checking prisma.user...");
    if (prisma.user) {
        console.log("prisma.user IS defined.");
        try {
            console.log("Attempting count...");
            const count = await prisma.user.count();
            console.log("User count:", count);
        } catch(e: any) {
            console.log("Count failed:", e.message);
            console.log("Full Error Code:", e.code);
        }
    } else {
        console.log("prisma.user is UNDEFINED.");
        // Check if any other prop exists
        // console.log("Prisma keys:", Object.getOwnPropertyNames(prisma));
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
