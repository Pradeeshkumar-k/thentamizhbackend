import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prisma } from '../utils/prisma';
import { TranslationService } from '../services/translationService';
import { ImageService } from '../services/imageService';
import redis, { getRedisViewCount, getRedisViewCounts, incrementViewCount } from '../utils/redis';
import { addTranslationJob } from '../utils/queue';
import { decodeAccessToken } from '../utils/jwt';

// Helper to get user info from optional Authorization header
const getUserFromHeader = (authHeader?: string): { userId: string, role: string } | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const payload = decodeAccessToken(token) as any;
    return {
      userId: payload?.userId || payload?.id || '',
      role: payload?.role || 'USER'
    };
  } catch {
    return null;
  }
};

// Helper: Build stable Redis cache key (Sorted query params)
const buildCacheKey = (query: any) => {
  const sorted = Object.keys(query)
    .sort()
    .reduce((acc: any, key) => {
      acc[key] = query[key];
      return acc;
    }, {});
  return `novels:list:${JSON.stringify(sorted)}`;
};

// Cache Invalidation
// Cache Invalidation for Novels
// Cache Invalidation for Novels (Version-based)
export const invalidateNovelCache = async () => {
    if (redis) {
        // Increment version to verify old keys (O(1) invalidation)
        await redis.incr('novels:cache:version');
        console.log('[CACHE] Invalidated novel list via version increment');
    }
};

// Cache Invalidation for Chapters
export const invalidateChapterCache = async (novelId: string) => {
    if (redis) {
        const key = `chapters:novel:${novelId}`;
        await redis.del(key);
        console.log(`[CACHE] Invalidated chapters for novel ${novelId}`);
    }
};

export const getNovels = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
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

    // console.log('[GET NOVELS] Starting request...');
    // console.log('[GET NOVELS] limit:', limit);
    
    // Redis Cache Key (Stable + Versioned)
    let cacheVersion = '1';
    if (redis) {
        cacheVersion = await redis.get('novels:cache:version') || '1';
    }
    const internalKey = buildCacheKey(req.query); // novels:list:{sorted_params}
    const cacheKey = `${internalKey}:v${cacheVersion}`;
    
    // Try to get from cache
    if (redis) {
        console.time('Redis Get');
        const cached = await redis.get(cacheKey);
        console.timeEnd('Redis Get');
        if (cached) {
            console.log('[CACHE HIT]', cacheKey);
            res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
            return res.json(JSON.parse(cached));
        }
    }

    console.time('DB Query');
    const novels = await prisma.novel.findMany({
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        titleEn: true, // Fetch English title
        coverImageUrl: true, // Only need coverImageUrl, not titleEn or status for list
        views: true,
        createdAt: true,
        author: { select: { name: true } },
        _count: { select: { chapters: true } },
        chapters: {
          orderBy: { order: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            titleEn: true,
            order: true
          }
        }
      },
    });
    console.timeEnd('DB Query');

    // Fetch Redis Views
    const ids = novels.map(n => n.id);
    const redisViews = await getRedisViewCounts('novel', ids);


    const normalized = novels.map(n => {
      let coverImage = n.coverImageUrl;
      
      // Optimally serve Base64 images via dedicated endpoint to reduce JSON payload
      if (coverImage && coverImage.startsWith('data:')) {
          let protocol = req.headers['x-forwarded-proto'] || req.protocol;
          const host = req.headers['x-forwarded-host'] || req.get('host');
          
          // Force HTTPS in production (Vercel/Railway) to avoid mixed content
          if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
              protocol = 'https';
          }

          coverImage = `${protocol}://${host}/api/novels/${n.id}/cover`;
      }

      return {
        id: n.id,
        title: n.title,
        titleEn: n.titleEn, // Added for localization
        coverImage: coverImage,
        views: (n.views || 0) + (redisViews[n.id] || 0), // Merge DB + Redis
        createdAt: n.createdAt,
        authorName: n.author?.name ?? 'Unknown',
        totalChapters: n._count?.chapters || 0,
        latestChapter: n.chapters?.[0] ? {
          id: n.chapters[0].id,
          title: n.chapters[0].title,
          titleEn: n.chapters[0].titleEn,
          order: n.chapters[0].order
        } : null
      };
    });

    const response = {
      novels: normalized,
      nextCursor: novels.length ? novels[novels.length - 1].id : null,
      hasMore: novels.length === limit,
    };

    // Store in cache (expire in 5 minutes)
    if (redis) {
       await redis.setex(cacheKey, 300, JSON.stringify(response));
    }

    // SWR: Cache for 1 min, but allow stale for another 30s while revalidating
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
    res.json(response);
  } catch (err) {
    console.error('[GET NOVELS ERROR]', err);
    if (err instanceof Error) {
        console.error('[GET NOVELS STACK]', err.stack);
    }
    res.status(500).json({ 
      message: 'Server error',
      error: err instanceof Error ? err.message : String(err),
      details: err instanceof Error ? err.stack : undefined
    });
  }
};

// Serve Cover Image directly (Decoder for Base64)
export const getNovelCover = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    try {
        const novel = await prisma.novel.findUnique({
            where: { id },
            select: { coverImageUrl: true }
        });

        if (!novel || !novel.coverImageUrl) {
            return res.status(404).send('Not found');
        }

        const cover = novel.coverImageUrl;

        // If it's a URL, redirect
        if (cover.startsWith('http')) {
            return res.redirect(cover);
        }

        // If Base64, decode and serve
        if (cover.startsWith('data:')) {
            const matches = cover.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(500).send('Invalid base64 string');
            }

            const type = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');

            res.writeHead(200, {
                'Content-Type': type,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=604800, immutable' // Cache for 7 days
            });
            res.end(buffer);
            return;
        }

        res.status(404).send('Image format not supported via API');

    } catch (error) {
        console.error('[GET COVER ERROR]', error);
        res.status(500).send('Server Error');
    }
};

export const getNovelById = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const user = getUserFromHeader(req.headers.authorization);
    const userId = user?.userId;
    const userRole = user?.role;

    const novel = await prisma.novel.findFirst({
      where: {
        id,
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
        authorId: true, // Need this for ownership check
        author: { select: { name: true } },
        _count: { select: { chapters: true, likes: true, bookmarks: true } },
        // Check if user has liked/bookmarked
        likes: userId ? { where: { userId }, select: { id: true } } : false,
        bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
      }
    });

    if (!novel) {
      return res.status(404).json({ message: "Not found" });
    }

    // Access Control: If not Published, only allow Admin or Author
    if (novel.status !== 'PUBLISHED') {
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        const isAuthor = userId === novel.authorId;
        
        if (!isAdmin && !isAuthor) {
            console.log(`[ACCESS DENIED] User ${userId} (Role: ${userRole}) tried to access draft novel ${id}`);
            return res.status(404).json({ message: "Not found" });
        }
        console.log(`[ACCESS GRANTED] Authorized user ${userId} accessing draft/private novel ${id}`);
    }

    // Merge DB views + Redis views
    const redisCount = await getRedisViewCount('novel', id);
    const totalViews = (novel.views || 0) + redisCount;

    if (!novel.titleEn || !novel.descriptionEn) {
      addTranslationJob('novel', id);
    }

    // Process Cover Image URL (Server-side optimization)
    let coverImage = (novel as any).coverImageUrl;
    if (coverImage && coverImage.startsWith('data:')) {
        let protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        
        // Force HTTPS in production
        if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
            protocol = 'https';
        }
        coverImage = `${protocol}://${host}/api/novels/${novel.id}/cover`;
    }

    // Normalize Data (Backend-side)
    const normalizedNovel = {
      ...novel,
      coverImage: coverImage,
      coverImageUrl: coverImage, // Update both for consistency
      author: (novel as any).author?.name || 'Unknown', 
      authorName: (novel as any).author?.name || 'Unknown',
      views: totalViews,
      totalChapters: (novel as any)._count?.chapters || 0,
      isLiked: userId ? (novel.likes as any[]).length > 0 : false,
      isBookmarked: userId ? (novel.bookmarks as any[]).length > 0 : false,
      likes: undefined, // Clear nested relations
      bookmarks: undefined
    };

    // PRIVATE: Contains user-specific data (likes/bookmarks)
    res.setHeader("Cache-Control", "private, no-store");
    res.json(normalizedNovel);
  } catch (err) {
    console.error("GET NOVEL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Admin: Create novel
export const createNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  const { 
      title, 
      description, novel_summary, 
      genre, categories, 
      coverImageUrl, cover_image, coverImage,
      status, 
      title_en, titleEn,
      summary_en, descriptionEn
  } = req.body;
  
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const dbDescription = description || novel_summary;
    let dbGenre = genre;
    if (!dbGenre) {
        if (categories && Array.isArray(categories)) dbGenre = categories.join(',');
        else if (categories) dbGenre = String(categories);
    }
    
    // Process Image
    const rawCoverImage = coverImageUrl || cover_image || coverImage || '';
    const dbCoverImage = await ImageService.processImage(rawCoverImage);

    let dbStatus = status ? status.toUpperCase() : 'DRAFT'; 

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

    await invalidateNovelCache();
    res.status(201).json(novel);
  } catch (error: any) {
    console.error('createNovel error:', error);
    res.status(500).json({ message: 'Error creating novel', error: error.message });
  }
};

// Admin: Update novel
export const updateNovel = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { 
      title, 
      description, novel_summary, 
      genre, categories, 
      coverImageUrl, cover_image, coverImage,
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

    const dbData: any = {};
    if (title) dbData.title = title;
    if (description || novel_summary) dbData.description = description || novel_summary;
    if (genre) dbData.genre = genre;
    else if (categories && Array.isArray(categories)) dbData.genre = categories.join(',');
    else if (categories) dbData.genre = String(categories);
    
    // Process Image if provided
    if (coverImageUrl || cover_image || coverImage) {
        const rawCoverImage = coverImageUrl || cover_image || coverImage;
        dbData.coverImageUrl = await ImageService.processImage(rawCoverImage);
    }
    
    if (title_en || titleEn) dbData.titleEn = title_en || titleEn;
    if (summary_en || descriptionEn) dbData.descriptionEn = summary_en || descriptionEn;
    if (status) dbData.status = status.toUpperCase();

    const novel = await prisma.novel.update({
      where: { id },
      data: dbData,
    });

    await invalidateNovelCache();
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
    await prisma.novel.update({
        where: { id },
        data: { 
            status: 'DELETED',
            // @ts-ignore
            deletedAt: new Date() 
        }
    });

    await invalidateNovelCache();
    console.log(`[SOFT DELETE] Novel ${id} marked as deleted`);

    res.json({ message: 'Novel deleted successfully' });

  } catch (error: any) {
    console.error("DELETE NOVEL ERROR:", error);
    if (!res.headersSent) res.status(500).json({ message: 'Error deleting novel', error: error.message });
  }
};

// Public: Get chapters for a novel
export const getChaptersByNovel = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const cacheKey = `chapters:novel:${id}`;

    // 1. Try Cache
    if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
            res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
            res.json(JSON.parse(cached));
            return;
        }
    }

    // 2. Fetch Novel Status for Access Control
    const novel = await prisma.novel.findUnique({
        where: { id },
        select: { status: true, authorId: true }
    });

    if (!novel || (novel as any).deletedAt) {
        res.status(404).json({ message: "Novel not found" });
        return;
    }

    if (novel.status !== 'PUBLISHED') {
        const user = getUserFromHeader(req.headers.authorization);
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
        const isAuthor = user?.userId === novel.authorId;

        if (!isAdmin && !isAuthor) {
            res.status(404).json({ message: "Not found" });
            return;
        }
    }

    // 3. DB Query
    const chapters = await prisma.chapter.findMany({
      where: { novelId: id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        titleEn: true,
        order: true,
        views: true,
        thumbnailUrl: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // 3. Fetch Redis View Counts for these chapters
    const chapterIds = chapters.map(c => c.id);
    const redisViews = await getRedisViewCounts('chapter', chapterIds);

    const formattedChapters = chapters.map((ch: any) => ({
      _id: ch.id, // Legacy compatibility
      id: ch.id,
      novelId: id,
      title: ch.title,
      titleEn: (ch as any).titleEn,
      chapterNumber: ch.order,
      order: ch.order,
      views: (ch.views || 0) + (redisViews[ch.id] || 0),
      thumbnail: ch.thumbnailUrl,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt
    }));

    const response = {
      chapters: formattedChapters,
      success: true
    };

    // 4. Store in Cache (5 mins)
    if (redis) {
        await redis.setex(cacheKey, 300, JSON.stringify(response));
    }

    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
    res.json(response);
  } catch (error) {
    console.error('getChaptersByNovel error:', error);
    res.status(500).json({ message: 'Error fetching chapters', error });
  }
};

// Public: Increment view count for novel (BUFFERED via Redis)
export const incrementNovelView = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  
  try {
    // Increment in Redis only
    await incrementViewCount('novel', id);
    return res.status(204).end();
  } catch (error) {
    console.error("INCREMENT NOVEL VIEW ERROR:", error);
    res.status(204).end();
  }
};
