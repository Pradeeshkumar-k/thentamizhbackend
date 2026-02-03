import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';
import { TranslationService } from '../services/translationService';
import { prismaWrite } from '../utils/prismaWrite';
import { addTranslationJob } from '../utils/queue';
import { decodeAccessToken } from '../utils/jwt';
import { getRedisViewCount } from '../utils/redis';

// Public: Get chapter content
// 🚀 FAST & SAFE
export const getChapterById = async (req: Request, res: Response) => {
  const chapterId = String(req.params.id);
  const lang = req.query.lang ? String(req.query.lang) : undefined;
  const isLoggedIn = Boolean(req.headers.authorization);

  try {
    // 🚫 No CDN cache for views
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    // REAL IP (Vercel-safe)
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    // Try to get userId if available (Optional Auth)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = decodeAccessToken(authHeader.split(' ')[1]) as any;
        userId = payload?.userId || payload?.id || null;
      } catch {}
    }

    // 🚀 Get real-time Redis increment
    const redisCount = await getRedisViewCount('chapter', chapterId);

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
          take: 20, // Paginate
          skip: Number(req.query.cursor ?? 0),
          include: {
            user: { select: { id: true, name: true } } // SECURE: No email
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
    // @ts-ignore
    } else if (chapter.isTranslating) {
      // isTranslating logic already handled by Cache-Control: private, no-store above
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
// Admin: Delete chapter
export const deleteChapter = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const existing = await prisma.chapter.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Chapter not found' });
      return;
    }

    // Manual Cascade Delete (Robust against missing DB Foreign Keys)
    await prisma.$transaction(async (tx) => {
        // 1. Delete Dependencies
        await tx.comment.deleteMany({ where: { chapterId: id } });
        await tx.like.deleteMany({ where: { chapterId: id } });
        await tx.readingProgress.deleteMany({ where: { chapterId: id } });

        // 2. Delete Chapter
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

// Public: Increment view count for chapter
export const incrementChapterView = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await prismaWrite.chapter.update({
      where: { id },
      data: {
        views: { increment: 1 }
      }
    });

    return res.status(204).end(); 
  } catch (error) {
    console.error("INCREMENT CHAPTER VIEW ERROR:", error);
    res.status(500).json({ message: "Error incrementing view" });
  }
};
