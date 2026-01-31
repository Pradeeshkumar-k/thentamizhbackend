import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';
import { TranslationService } from '../services/translationService';
import { decodeAccessToken } from '../utils/jwt';


// Simple In-Memory Cache for Novel List
let novelListCache: { data: any[], timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 Hour TTL

// Exported Cache Invalidation used by Admin Controller
export const invalidateNovelCache = () => {
    novelListCache = null;
    console.log('[Cache] Novel list cache invalidated');
};

// Public: Get all novels
export const getNovels = async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 10, search, sort } = req.query;
  // console.log(`[getNovels] Request: page=${page} limit=${limit} search=${search}`);
  // console.log('[getNovels] Fix Applied: Safe Author Access');
  
  try {
    // Add Cache-Control for Vercel Edge Caching
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // Safeguard: Exclude legacy numeric IDs that cause Prisma "Inconsistent column data" errors
    // We only want UUID-like strings (usually 36 chars) or at least not single digits
    where.id = { notIn: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] };

    // Optimization: Check Cache (Only if no search filters)
    if (!search && novelListCache && (Date.now() - novelListCache.timestamp < CACHE_TTL)) {
       // console.log('[getNovels] Serving from Cache ⚡');
       const cachedNovels = novelListCache.data;
       res.json({
          novels: cachedNovels,
          total: 100, // Dummy
          page: Number(page),
          limit: Number(limit)
       });
       return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Parallelize findMany and count for performance
    const [novels, total] = await Promise.all([
      prisma.novel.findMany({
        where,
        take: Number(limit),
        skip,
        select: {
          id: true,
          title: true,
          titleEn: true, 
          // genre: true, // Removed for performance
          status: true, // Kept for frontend filtering (Ongoing/Completed)
          coverImageUrl: true,
          // views: true, // Removed for performance optimization if not crucial for list items
          createdAt: true,
          updatedAt: true,
          author: { select: { name: true, email: true } },
          // _count: { select: { chapters: true } } // Removed for performance to avoid extra join/count
        },
        orderBy: { createdAt: 'desc' } 
      }),
      prisma.novel.count({ where })
    ]);

    const formattedNovels = novels.map((novel: any) => ({
      _id: novel.id, // Legacy support
      id: novel.id,
      title: novel.title,
      titleEn: novel.titleEn,
      // genre: novel.genre,
      status: novel.status,
      coverImage: novel.coverImageUrl,
      author: novel.author?.name || novel.author?.email?.split('@')[0] || 'Unknown',
      // totalChapters: novel._count?.chapters || 0,
      stats: {
        // views: novel.views,
        views: 0, // Placeholder
        likes: 0,
        bookmarks: 0
      },
      createdAt: novel.createdAt,
      updatedAt: novel.updatedAt
    }));

    if (!search) {
      novelListCache = { data: formattedNovels, timestamp: Date.now() };
    }

    res.json({
      novels: formattedNovels,
      total,
      page: Number(page),
      limit: Number(limit),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('ANTIGRAVITY_DEBUG_ERROR [getNovels]:', error);
    // res.status(500).json({ message: 'Error fetching novels', error: error.message });
     // DEBUG MODE: Return full error details
     res.status(500).json({ 
         message: 'Error fetching novels', 
         error_message: error.message,
         error_code: error.code,
         error_meta: error.meta,
         stack: error.stack
     });
  }
};

// Internal Warmup Function
export const warmUpCache = async () => {
    console.log('[Cache Warmup] Starting...');
    try {
        const novels = await prisma.novel.findMany({
            take: 100, // Pre-warm standard limit
            select: {
                 id: true,
                 title: true,
                 genre: true,
                 status: true,
                 coverImageUrl: true,
                 views: true,
                 createdAt: true,
                 updatedAt: true,
                 author: { select: { name: true, email: true } },
                 _count: { select: { chapters: true } } 
            },
            orderBy: { createdAt: 'desc' } 
        });

        const formattedNovels = novels.map((novel: any) => ({
            _id: novel.id,
            id: novel.id,
            title: novel.title,
            genre: novel.genre,
            status: novel.status,
            coverImage: novel.coverImageUrl,
            author: novel.author?.name || novel.author?.email?.split('@')[0] || 'Unknown',
            totalChapters: novel._count?.chapters || 0,
            stats: {
                views: novel.views,
                likes: 0, 
                bookmarks: 0
            },
            createdAt: novel.createdAt,
            updatedAt: novel.updatedAt
        }));

        novelListCache = {
            data: formattedNovels,
            timestamp: Date.now()
        };
        console.log(`[Cache Warmup] Success! ${novels.length} novels cached.`);
    } catch (e) {
        console.error('[Cache Warmup] Failed', e);
    }
};

// Cache for Single Novels (ID -> { data, timestamp })
const novelCache = new Map<string, { data: any, timestamp: number }>();
const NOVEL_CACHE_TTL = 60 * 60 * 1000; // 1 Hour TTL

// Public: Get novel by ID
export const getNovelById = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { lang } = req.query; // Support lang=english query param
  
  // Cache Key includes Lang to cache translations separately
  const cacheKey = `${id}-${lang || 'default'}`;

  // Helper to get User ID from optional token (Safe Decode)
  const getUserIdFromToken = (req: Request): string | null => {
      try {
          const auth = req.headers.authorization;
          if (!auth?.startsWith("Bearer ")) return null;
          const token = auth.split(" ")[1];
          // @ts-ignore
          const decoded: any = decodeAccessToken(token); 
          return decoded?.userId ?? null;
      } catch {
          return null;
      }
  };

  try {
    console.log("[getNovelById] START", id, lang);

    // Add Cache-Control for Vercel Edge Caching
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    let formattedNovel: any = null;

    // 1. Check Cache
    const cached = novelCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < NOVEL_CACHE_TTL)) {
       console.log(`[getNovelById] Serving ${id} from Cache ⚡`);
       // Fire-and-forget view increment (Non-blocking)
       prisma.novel.update({
          where: { id },
          data: { views: { increment: 1 } },
       }).catch(err => console.error("[Analytics] View increment failed", err));

       formattedNovel = cached.data;
    } else {
        // 2. Fetch from DB if not in cache
        const novel = await prisma.novel.findUnique({
          where: { id },
          include: {
            author: { select: { id: true, name: true, email: true } },
            chapters: {
              orderBy: { order: 'asc' },
              select: { id: true, title: true, titleEn: true, order: true, createdAt: true }
            },
            _count: { select: { likes: true, bookmarks: true } }
          }
        });

        if (!novel) {
          res.status(404).json({ message: 'Novel not found' });
          return;
        }

        // Auto-Translation Logic (Background / Fire-and-Forget)
        if (lang === 'english' && (!novel.titleEn || !novel.descriptionEn)) {
            try {
                // Fire and forget
                Promise.resolve(TranslationService.translateAndSaveNovel(id))
                    .catch(err => console.error("[Background] Translation trigger failed:", err));
            } catch (err) {
                console.error("[Translation Trigger Crash]", err);
            }
        }

        const n = novel as any;
        formattedNovel = {
          ...n,
          _id: n.id,
          id: n.id,
          title: n.title,
          titleEn: n.titleEn,
          description: n.description,
          descriptionEn: n.descriptionEn,
          genre: n.genre,
          status: n.status,
          coverImage: n.coverImageUrl,
          author: n.author?.name || n.author?.email?.split('@')[0] || 'Unknown',
          chapters: n.chapters ? n.chapters.map((c: any) => ({
             ...c,
             title: c.title,
             titleEn: c.titleEn
          })) : [],
          tags: n.genre ? [n.genre] : [], // REAL DATA: Genre as tag
          stats: {
             views: n.views,
             likes: n._count?.likes || 0,
             bookmarks: n._count?.bookmarks || 0
          }
        };

        // Set Cache
        novelCache.set(cacheKey, { data: formattedNovel, timestamp: Date.now() });
        
        // Async view increment (Non-blocking)
        prisma.novel.update({
             where: { id },
             data: { views: { increment: 1 } },
        }).catch(err => console.error("[Analytics] View increment failed", err));
    }

    // 3. Append User Interaction Status (Bypass Cache for this)
    const userId = getUserIdFromToken(req);
    let isLiked = false;
    let isBookmarked = false;

    if (userId) {
        const [like, bookmark] = await Promise.all([
            prisma.novelLike.findUnique({ where: { userId_novelId: { userId, novelId: id } } }),
            prisma.bookmark.findUnique({ where: { userId_novelId: { userId, novelId: id } } })
        ]);
        isLiked = !!like;
        isBookmarked = !!bookmark;
    }

    console.log("[getNovelById] SUCCESS", id);
    res.json({
      novel: formattedNovel,
      chapters: formattedNovel.chapters || [],
      isLiked,       // New Field
      isBookmarked   // New Field
    });

  } catch (error) {
    console.error('getNovelById error:', error);
    res.status(500).json({ message: 'Error fetching novel', error });
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
export const deleteNovel = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const existing = await prisma.novel.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Novel not found' });
      return;
    }

    await prisma.novel.delete({ where: { id } });
    
    // Invalidate Cache
    invalidateNovelCache();
    
    res.json({ message: 'Novel deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting novel', error: error.message });
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
        // thumbnailUrl: true, // Excluded for performance
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
      // thumbnail: ch.thumbnailUrl, // Excluded for performance
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

