import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prismaRead } from '../utils/prismaRead';
import { prismaWrite } from '../utils/prismaWrite';
import { TranslationService } from '../services/translationService';
import { addTranslationJob } from '../utils/queue';
import { decodeAccessToken } from '../utils/jwt';
import { getRedisViewCount, incrementViewCount } from '../utils/redis';

// Public: Get chapter content
// 🚀 FAST & SAFE
export const getChapterById = async (req: Request, res: Response) => {
  const chapterId = String(req.params.id);
  const lang = req.query.lang ? String(req.query.lang) : undefined;

  try {
    // 🚫 No CDN cache for views
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    // Try to get userId if available (Optional Auth)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = decodeAccessToken(authHeader.split(' ')[1]) as any;
        userId = payload?.userId || payload?.id || null;
      } catch {}
    }

    // REAL IP (Vercel-safe)
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    // Count only once per 10 seconds (TESTING)
    const TIME_WINDOW = new Date(Date.now() - 10 * 1000); 

    const whereCondition = {
      chapterId: chapterId,
      OR: [
        userId ? { userId } : undefined,
        { ip },
      ].filter(Boolean) as any,
      viewedAt: { gte: TIME_WINDOW },
    };

    // @ts-ignore - Handle chapterView safely
    const alreadyViewed = await prismaRead.chapterView.findFirst({
      where: whereCondition,
    });

    if (!alreadyViewed) {
      // Persistent view recording with ATOMIC INCREMENT
      await prismaWrite.$transaction([
        prismaWrite.chapterView.create({
          data: { chapterId, userId, ip },
        }),
        prismaWrite.chapter.update({
          where: { id: chapterId },
          data: { views: { increment: 1 } }
        })
      ]).then(() => console.log(`[VIEW] New atomic view recorded for ${chapterId} (IP: ${ip})`))
        .catch(err => console.error("chapterView transaction error:", err));
        
      // Also increment Redis just in case frontend relies on it for something else, 
      // but DB is now the source of truth.
      incrementViewCount('chapter', chapterId);
    }


    // 🚀 Get real-time Redis increment buffer
    const redisCount = await getRedisViewCount('chapter', chapterId);

    const chapter = await prismaRead.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        title: true,
        titleEn: true,
        content: true,
        contentEn: true,
        order: true,
        likes: {
          select: { userId: true }
        },
        comments: {
          take: 20, 
          skip: Number(req.query.cursor ?? 0),
          include: {
            user: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { likes: true, comments: true }
        },
        views: true
      }
    });

    if (!chapter) {
      res.status(404).json({ message: "Chapter not found" });
      return;
    }

    // 🔥 Synchronous English Translation
    if (lang === 'english' && !chapter.contentEn) {
      const translated = await TranslationService.translateAndSaveChapter(chapterId as string);
      if (translated) {
        chapter.contentEn = translated;
      }
    }

    res.json({
      ...chapter,
      views: (chapter.views || 0) + redisCount,
      chapterNumber: (chapter as any).order,
      likeCount: (chapter as any)._count?.likes ?? 0,
      likedByMe: userId
        ? (chapter as any).likes?.some((l: any) => l.userId === userId)
        : false
    });

  } catch (error) {
    console.error("getChapterById error:", error);
    res.status(500).json({ message: "Error fetching chapter" });
  }
};

// Admin: Create chapter
export const createChapter = async (req: Request, res: Response): Promise<void> => {
  const { novelId, title, content, order, thumbnailUrl } = req.body;
  try {
    const chapter = await prismaWrite.chapter.create({
      data: {
        novelId,
        title,
        content,
        order,
        thumbnailUrl
      },
    });
    res.status(201).json(chapter);
  } catch (error) {
    res.status(500).json({ message: 'Error creating chapter', error: (error as any).message });
  }
};

// Admin: Update chapter
export const updateChapter = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { title, content, order, thumbnailUrl } = req.body;
  try {
    const existing = await prismaRead.chapter.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Chapter not found' });
      return;
    }

    const chapter = await prismaWrite.chapter.update({
      where: { id },
      data: { title, content, order, thumbnailUrl },
    });
    res.json(chapter);
  } catch (error) {
    res.status(500).json({ message: 'Error updating chapter', error: (error as any).message });
  }
};

// Admin: Delete chapter
export const deleteChapter = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const existing = await prismaRead.chapter.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Chapter not found' });
      return;
    }

    await prismaWrite.$transaction(async (tx) => {
        await tx.comment.deleteMany({ where: { chapterId: id } });
        await tx.like.deleteMany({ where: { chapterId: id } });
        await tx.readingProgress.deleteMany({ where: { chapterId: id } });
        await tx.chapter.delete({ where: { id } });
    });

    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error("DELETE CHAPTER ERROR:", error);
    res.status(500).json({ message: 'Error deleting chapter', error: (error as any).message });
  }
};

// User: Like chapter
export const likeChapter = async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  await prismaWrite.like.upsert({
    where: {
      chapterId_userId: {
        chapterId: id,
        userId
      }
    },
    update: {},
    create: {
      chapterId: id,
      userId
    }
  });

  res.json({ message: 'Chapter liked' });
};

// User: Unlike chapter
export const unlikeChapter = async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    await prismaWrite.like.delete({
      where: {
        chapterId_userId: {
          chapterId: id,
          userId,
        },
      },
    });
    res.json({ message: 'Chapter unliked' });
  } catch (error) {
    res.status(500).json({ message: 'Error unliking chapter', error: (error as any).message });
  }
};

// Public: Increment view count for chapter (REAL-TIME FIX)
export const incrementChapterView = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  try {
    // Try to get userId from token if present
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = decodeAccessToken(authHeader.split(' ')[1]) as any;
        userId = payload?.userId || payload?.id || null;
      } catch {}
    }

    // Count only once per 24 hours
    const TWENTY_FOUR_HOURS = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const whereCondition = {
      chapterId: id,
      OR: [
        userId ? { userId } : undefined,
        { ip },
      ].filter(Boolean) as any,
      viewedAt: { gte: TWENTY_FOUR_HOURS },
    };

    // @ts-ignore - Check if already viewed
    const alreadyViewed = await prismaRead.chapterView.findFirst({
      where: whereCondition,
    });

    if (!alreadyViewed) {
      // 1. Log to history (Fire & Forget to avoid blocking)
      prismaWrite.chapterView.create({
        data: { chapterId: id, userId, ip }
      }).catch(err => console.error("ChapterView logging error:", err));

      // 2. Increment REDIS counter (Fast & Real-time)
      // This key is read by getChapterById to show instant updates
      await incrementViewCount('chapter', id);
    }

    return res.status(204).end(); 
  } catch (error) {
    console.error("INCREMENT CHAPTER VIEW ERROR:", error);
    // Return success anyway to not break client
    res.status(204).end();
  }
};
