
import { prisma } from './src/utils/prisma';

async function main() {
  try {
    await prisma.$connect();
    
    const novels = await prisma.novel.findMany();
    
    for (const n of novels) {
        let newCover = n.coverImageUrl;
        
        // 1. Fix "Shadow Novel" (The one stuck with Base64)
        // If title contains "நிழல்களின்", map to Swetha card (best guess based on "shadows")
        if (n.title.includes('நிழல்களின்') && n.coverImageUrl && n.coverImageUrl.startsWith('data:')) {
            newCover = '/assets/covers/swetha card.jpg';
        }

        // 2. Fix inconsistent paths
        // "Novel Card/Mohana card.jpg" -> "/assets/covers/Mohana card.jpg"
        if (newCover && newCover.includes('Novel Card/')) {
            const filename = newCover.split('/').pop();
            if (filename) {
                newCover = `/assets/covers/${filename}`;
            }
        }

        // 3. Fix "Thenmozhi Card.jpg" (ensure prefix)
        // If it's just a filename or partial path, ensure it starts with /assets/covers/
        if (newCover && !newCover.startsWith('/assets/covers/') && !newCover.startsWith('http') && !newCover.startsWith('data:')) {
             const filename = newCover.split('/').pop();
             if (filename) newCover = `/assets/covers/${filename}`;
        }
        
        if (newCover !== n.coverImageUrl) {
            console.log(`Updating "${n.title}"`);
            console.log(`   Old: ${n.coverImageUrl?.substring(0, 50)}...`);
            console.log(`   New: ${newCover}`);
            
            await prisma.novel.update({
                where: { id: n.id },
                data: { coverImageUrl: newCover }
            });
        }
    }
  } catch(e) {
      console.error(e);
  }
}
main();
