import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prisma } from '../utils/prisma';
import { prisma } from '../utils/prisma';

// Update Reading Progress
export const updateReadingProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId, chapterId, lastChapter, progress, isCompleted } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

    // Support both chapterId and lastChapter (from frontend migration)
    const activeChapterId = chapterId || lastChapter;

    if (!novelId || !activeChapterId) {
      res.status(400).json({ message: 'Novel ID and Chapter ID are required' });
      return;
    }

    // Upsert progress (Create or Update)
    const readingProgress = await prisma.readingProgress.upsert({
      where: {
        userId_novelId: {
          userId,
          novelId
        }
      },
      update: {
        chapterId: activeChapterId,
        progress: progress || 0,
        lastRead: new Date()
      },
      create: {
        userId,
        novelId,
        chapterId: activeChapterId,
        progress: progress || 0,
        lastRead: new Date()
      }
    });

    res.json({ success: true, data: readingProgress });
  } catch (error) {
    console.error('updateReadingProgress error:', error);
    res.status(500).json({ success: false, message: 'Error updating reading progress', error });
  }
};

// Get Reading Progress
export const getReadingProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

    // If novelId is provided, get progress for that specific novel
    if (novelId) {
      const progress = await prisma.readingProgress.findUnique({
        where: {
          userId_novelId: {
            userId,
            novelId: String(novelId)
          }
        },
        include: {
          chapter: {
              select: {
                  id: true,
                  title: true,
                  order: true
              }
          }
        }
      });
      res.json({ success: true, data: progress });
      return;
    }

    // If no novelId, return ALL progress for the user
    // For now, let's just return all as "ongoing" or categorize them
    const allProgress = await prisma.readingProgress.findMany({
      where: { userId },
      include: {
        novel: {
          select: {
            id: true,
            title: true,
            coverImageUrl: true,
            author: { select: { name: true } }
          }
        }
      }
    });

    // Format for frontend ReadingProgressContext
    const formattedProgress = {
      ongoing: allProgress.map(p => ({
        novelId: p.novelId,
        novelTitle: p.novel.title,
        coverImage: p.novel.coverImageUrl,
        author: p.novel.author?.name || 'Unknown',
        lastChapter: p.chapterId,
        updatedAt: p.lastRead
      })),
      completed: [] // We don't have a completion flag in DB yet, but could add it
    };

    res.json({ success: true, data: formattedProgress });
  } catch (error) {
    console.error('getReadingProgress error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reading progress', error });
  }
};
