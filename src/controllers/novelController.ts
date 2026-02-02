import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';
import { TranslationService } from '../services/translationService';


// Cache Invalidation (No-op as in-memory cache is removed)
export const invalidateNovelCache = () => {
    // console.log('[Cache] Invalidation called (Cache Disabled)');
};

// Public: Get all novels (Optimized)
export const getNovels = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page || 0), 0);
    const limit = 20;
    const search = req.query.search?.toString();

    const where: any = {
      status: 'PUBLISHED',
      // @ts-ignore
      deletedAt: null
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } }
      ];
    }

    const novels = await prisma.novel.findMany({
      where,
      take: limit,
      skip: page * limit,
      select: {
        id: true,
        title: true,
        titleEn: true,
        coverImageUrl: true,
        createdAt: true,
        status: true, // Added for verify
        author: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );

    // Normalize Data (Backend-side)
    const normalizedNovels = novels.map((n: any) => ({
      ...n,
      coverImage: n.coverImageUrl,
      author: n.author?.name || 'Unknown' // Flatten author object
    }));

    // 🔥 Pre-translation trigger (fire-and-forget)
    novels.forEach(n => {
      if (!n.titleEn) {
        TranslationService.translateAndSaveNovel(n.id);
      }
    });

    res.json({
      novels: normalizedNovels,
      page,
      limit,
      hasMore: novels.length === limit
    });
  } catch (err) {
    console.error('[GET NOVELS ERROR]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: Get novel by ID (Optimized)
export const getNovelById = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  
  try {
    const novel = await prisma.novel.findFirst({
      where: {
        id,
        status: 'PUBLISHED', 
        // @ts-ignore
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        titleEn: true,
        description: true,
        descriptionEn: true,
        genre: true,
        status: true,
        coverImageUrl: true,
        views: true,
        author: { select: { name: true } },
        chapters: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, titleEn: true, order: true }
        },
        _count: { select: { likes: true, bookmarks: true } }
      }
    });

    if (!novel) {
      return res.status(404).json({ message: "Not found" });
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    // 🔥 Fire-and-forget view increment & pre-translation
    prisma.novel.update({
      where: { id },
      data: { views: { increment: 1 } }
    }).catch(() => {});

    if (!novel.titleEn || !novel.descriptionEn) {
      TranslationService.translateAndSaveNovel(id);
    }

    // Normalize Data (Backend-side)
    const normalizedNovel = {
      ...novel,
       coverImage: (novel as any).coverImageUrl,
       author: (novel as any).author?.name || 'Unknown' // Flatten author object
    };

    res.json(normalizedNovel);
  } catch (err) {
    console.error("GET NOVEL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Admin: Create novel
// Admin: Create novel
export const createNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  // Destructure all possible frontend fields
  const { 
      title, 
      description, novel_summary, 
      genre, categories, 
      coverImageUrl, cover_image, 
      status, 
      title_en, titleEn,
      summary_en, descriptionEn
  } = req.body;
  
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    // Logic to determine final DB values
    const dbDescription = description || novel_summary;
    
    let dbGenre = genre;
    if (!dbGenre) {
        if (categories && Array.isArray(categories)) dbGenre = categories.join(',');
        else if (categories) dbGenre = String(categories);
    }

    const dbCoverImage = coverImageUrl || cover_image;
    
    // Status normalization
    let dbStatus = status ? status.toUpperCase() : 'DRAFT'; 
    // Validate Status against Enum if needed, but Prisma will throw if invalid. 
    // Frontend likely sends 'Draft', 'Published'.

    const novel = await prisma.novel.create({
      data: {
        title,
        titleEn: title_en || titleEn,
        description: dbDescription,
        descriptionEn: summary_en || descriptionEn,
        genre: dbGenre,
        coverImageUrl: dbCoverImage,
        status: dbStatus,
        authorId: req.user.userId,
      },
    });

    // Invalidate Cache
    invalidateNovelCache();

    res.status(201).json(novel);
  } catch (error: any) {
    console.error('createNovel error:', error);
    res.status(500).json({ message: 'Error creating novel', error: error.message });
  }
};

// Admin: Update novel
export const updateNovel = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  // Destructure all possible fields from frontend
  const { 
      title, 
      description, novel_summary, 
      genre, categories, 
      coverImageUrl, cover_image, 
      status, 
      title_en, titleEn,
      summary_en, descriptionEn
  } = req.body;

  try {
    const existing = await prisma.novel.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Novel not found' });
      return;
    }

    // Map Frontend fields to DB fields
    const dbData: any = {};
    if (title) dbData.title = title;
    // Map 'novel_summary' (frontend) -> 'description' (db)
    if (description || novel_summary) dbData.description = description || novel_summary;
    
    // Map 'categories' (frontend array) -> 'genre' (db string)
    if (genre) dbData.genre = genre;
    else if (categories && Array.isArray(categories)) dbData.genre = categories.join(',');
    else if (categories) dbData.genre = String(categories);

    // Map 'cover_image' (frontend) -> 'coverImageUrl' (db)
    if (coverImageUrl || cover_image) dbData.coverImageUrl = coverImageUrl || cover_image;

    // English Interface Fields
    if (title_en || titleEn) dbData.titleEn = title_en || titleEn;
    if (summary_en || descriptionEn) dbData.descriptionEn = summary_en || descriptionEn;

    // Status: Convert 'Published' -> 'PUBLISHED'
    if (status) dbData.status = status.toUpperCase();

    const novel = await prisma.novel.update({
      where: { id },
      data: dbData,
    });

    // Invalidate Cache
    invalidateNovelCache();

    res.json({ success: true, data: novel });
  } catch (error: any) {
    console.error('updateNovel error:', error);
    res.status(500).json({ message: 'Error updating novel', error: error.message });
  }
};

// Admin: Delete novel
// Admin: Delete novel
// Admin: Delete novel
export const deleteNovel = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    // Respond early to prevent timeouts
    res.status(202).json({ message: 'Deletion processing in background' });

    // Run deletion async (fire-and-forget)
    setImmediate(async () => {
        try {
            await prisma.$transaction(async (tx) => {
                // 1. Delete Novel Dependencies
                await tx.readingProgress.deleteMany({ where: { novelId: id } });
                await tx.bookmark.deleteMany({ where: { novelId: id } });
                await tx.novelLike.deleteMany({ where: { novelId: id } });

                // 2. Find Chapters to delete their dependencies
                const chapters = await tx.chapter.findMany({ 
                    where: { novelId: id },
                    select: { id: true }
                });
                const chapterIds = chapters.map(c => c.id);

                if (chapterIds.length > 0) {
                    // 3. Delete Chapter Dependencies
                    await tx.comment.deleteMany({ where: { chapterId: { in: chapterIds } } });
                    await tx.like.deleteMany({ where: { chapterId: { in: chapterIds } } });
                    await tx.readingProgress.deleteMany({ where: { chapterId: { in: chapterIds } } });
                    
                    // 4. Delete Chapters
                    await tx.chapter.deleteMany({ where: { novelId: id } });
                }

                // 5. Finally Delete Novel
                await tx.novel.delete({ where: { id } });
            });

            invalidateNovelCache();
            console.log(`[DELETE] Novel ${id} removed successfully`);
        } catch (err) {
            console.error("[DELETE FAILED]", err);
        }
    });

  } catch (error: any) {
    console.error("DELETE NOVEL ERROR:", error);
    if (!res.headersSent) res.status(500).json({ message: 'Error deleting novel', error: error.message });
  }
};

// Public: Get chapters for a novel
export const getChaptersByNovel = async (req: Request, res: Response): Promise<void> => {
  try {
    // Add Cache-Control for Vercel Edge Caching
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    const id = String(req.params.id); // Expecting novelId as :id for consistency with other public routes or :novelId

    const chapters = await prisma.chapter.findMany({
      where: { novelId: id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        titleEn: true, // Include English Title
        order: true,
        views: true,
        thumbnailUrl: true, // Included
        createdAt: true,
        updatedAt: true
        // Exclude content for list view
      }
    });

    // Map to frontend expected format
    const formattedChapters = chapters.map((ch: any) => ({
      _id: ch.id,
      id: ch.id,
      novelId: id,
      title: ch.title,
      titleEn: (ch as any).titleEn, // Include English Title
      chapterNumber: ch.order,
      order: ch.order,
      views: ch.views,
      thumbnail: ch.thumbnailUrl, // Included
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt
    }));

    res.json({
      chapters: formattedChapters,
      success: true
    });
  } catch (error) {
    console.error('getChaptersByNovel error:', error);
    res.status(500).json({ message: 'Error fetching chapters', error });
  }
};

