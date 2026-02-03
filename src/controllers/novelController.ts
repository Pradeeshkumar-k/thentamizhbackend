import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';
import { TranslationService } from '../services/translationService';
import { incrementViewCount, getRedisViewCount, getRedisViewCounts } from '../utils/redis';
import { addTranslationJob } from '../utils/queue';
import { decodeAccessToken } from '../utils/jwt';

// Helper to get userId from optional Authorization header
const getUserIdFromHeader = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const payload = decodeAccessToken(token) as any;
    return payload?.userId || payload?.id || null;
  } catch {
    return null;
  }
};


// Cache Invalidation (No-op as in-memory cache is removed)
export const invalidateNovelCache = () => {
    // console.log('[Cache] Invalidation called (Cache Disabled)');
};

export const getNovels = async (req: Request, res: Response) => {
  try {
    const limit = 20;
    const cursor = req.query.cursor as string | undefined;
    const search = req.query.search?.toString();

    const where: any = {
      status: 'PUBLISHED',
      // @ts-ignore
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } }
      ];
    }

    const novels = await prisma.novel.findMany({
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        titleEn: true,
        coverImageUrl: true,
        views: true,
        status: true,
        createdAt: true,
        author: { select: { name: true } },
        _count: { select: { chapters: true, likes: true } }
      },
    });

    // 🚀 NEW: Batch fetch real-time Redis increments
    const novelIds = novels.map(n => n.id);
    const redisIncrements = await getRedisViewCounts('novel', novelIds);

    const normalized = novels.map(n => ({
      id: n.id,
      title: n.title,
      titleEn: n.titleEn,
      coverImage: n.coverImageUrl,
      views: (n.views || 0) + (redisIncrements[n.id] || 0),
      createdAt: n.createdAt,
      authorName: n.author?.name ?? 'Unknown',
      totalChapters: n._count?.chapters || 0,
      likeCount: n._count?.likes || 0,
      status: n.status
    }));

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );

    // 🔥 Controlled translation trigger (Queue/Fire-and-forget)
    novels.forEach(n => {
      if (!n.titleEn) {
        addTranslationJob('novel', n.id);
      }
    });

    res.json({
      novels: normalized,
      nextCursor: novels.length ? novels[novels.length - 1].id : null,
      hasMore: novels.length === limit,
    });
  } catch (err) {
    console.error('[GET NOVELS]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getNovelById = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const userId = getUserIdFromHeader(req.headers.authorization);

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
          select: { id: true, title: true, titleEn: true, order: true, views: true }
        },
        _count: { select: { chapters: true, likes: true, bookmarks: true } },
        // Check if user has liked/bookmarked
        likes: userId ? { where: { userId }, select: { id: true } } : false,
        bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
      }
    });

    if (!novel) {
      return res.status(404).json({ message: "Not found" });
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    // 🔥 Optimized view increment (Redis REST)
    await incrementViewCount('novel', id);
    
    // 🚀 Get real-time total
    const redisCount = await getRedisViewCount('novel', id);
    const totalViews = (novel.views || 0) + redisCount;

    if (!novel.titleEn || !novel.descriptionEn) {
      addTranslationJob('novel', id);
    }

    // Normalize Data (Backend-side)
    const normalizedNovel = {
      ...novel,
      coverImage: (novel as any).coverImageUrl,
      author: (novel as any).author?.name || 'Unknown', 
      authorName: (novel as any).author?.name || 'Unknown',
      views: totalViews,
      totalChapters: (novel as any)._count?.chapters || 0,
      isLiked: userId ? (novel.likes as any[]).length > 0 : false,
      isBookmarked: userId ? (novel.bookmarks as any[]).length > 0 : false,
      likes: undefined, // Clear nested relations
      bookmarks: undefined
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

    // Run soft deletion async (fire-and-forget)
    setImmediate(async () => {
        try {
            await prisma.novel.update({
                where: { id },
                data: { 
                    status: 'DELETED',
                    // @ts-ignore
                    deletedAt: new Date() 
                }
            });

            invalidateNovelCache();
            console.log(`[SOFT DELETE] Novel ${id} marked as deleted`);
        } catch (err) {
            console.error("[SOFT DELETE FAILED]", err);
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

