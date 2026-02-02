import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';
import { TranslationService } from '../services/translationService';

// Public: Get chapter content
// 🚀 FAST & SAFE
export const getChapterById = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const lang = req.query.lang ? String(req.query.lang) : undefined;

  try {
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        titleEn: true,
        content: true,
        contentEn: true,
        order: true,
      }
    });

    if (!chapter) {
      res.status(404).json({ message: "Chapter not found" });
      return;
    }

    // 🔥 Fire-and-forget translation (NO await)
    if (lang === "english" && !chapter.contentEn) {
      TranslationService.translateAndSaveChapter?.(id)
        .catch(() => {});
    }

    // 🔥 Fire-and-forget view increment
    prisma.chapter.update({
      where: { id },
      data: { views: { increment: 1 } }
    }).catch(() => {});

    res.json({
      ...chapter,
      chapterNumber: chapter.order
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
export const likeChapter = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user?.userId;

  if (!userId) {
     res.status(401).json({ message: 'Unauthorized' });
     return;
  }

  try {
    await prisma.like.create({
      data: {
        chapterId: id,
        userId,
      },
    });
    res.status(201).json({ message: 'Chapter liked' });
  } catch (error) {
    res.status(400).json({ message: 'Error liking chapter (already liked?)', error: (error as any).message });
  }
};

// User: Unlike chapter
export const unlikeChapter = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
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
