import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prisma } from '../utils/prisma';
import { prisma } from '../utils/prisma';
import { TranslationService } from '../services/translationService';
import { addTranslationJob } from '../utils/queue';
import { decodeAccessToken } from '../utils/jwt';
import redis, { getRedisViewCount, incrementViewCount } from '../utils/redis';

// Public: Get chapter content
// 🚀 FAST & SAFE - READ ONLY
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


    const chapter = await prisma.chapter.findUnique({
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

    // 🔥 Asynchronous English Translation (Non-blocking)
    if (lang === 'english' && !chapter.contentEn) {
      // Trigger background translation job
      addTranslationJob('chapter', chapterId as string);
    }

    res.json({
      ...chapter,
      views: chapter.views || 0,
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
    const chapter = await prisma.chapter.create({
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
    const existing = await prisma.chapter.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Chapter not found' });
      return;
    }

    const chapter = await prisma.chapter.update({
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
    const existing = await prisma.chapter.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Chapter not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
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

  await prisma.like.upsert({
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
    await prisma.like.delete({
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
  const chapterId = String(req.params.id);

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  let userId: string | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = decodeAccessToken(authHeader.split(' ')[1]) as any;
      userId = payload?.userId || payload?.id || null;
    } catch {}
  }

  try {
    // 1️⃣ Dedup (24h)
    const exists = await prisma.chapterView.findFirst({
      where: {
        chapterId,
        OR: [
          userId ? { userId } : undefined,
          { ip }
        ].filter(Boolean) as any,
        viewedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    if (!exists) {
      // Direct DB increment
      await prisma.chapter.update({
        where: { id: chapterId },
        data: { views: { increment: 1 } },
      });

      // 3️⃣ Fire-and-forget history log
      prisma.chapterView.create({
        data: { chapterId, userId, ip }
      }).catch(console.error);
    }

    return res.status(204).end();
  } catch (err) {
    console.error("incrementChapterView error:", err);
    return res.status(204).end();
  }
};
