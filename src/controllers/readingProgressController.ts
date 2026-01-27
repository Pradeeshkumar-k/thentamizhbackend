import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';

// Update Reading Progress
export const updateReadingProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId, chapterId, progress } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

    if (!novelId || !chapterId) {
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
        chapterId,
        progress: progress || 0,
        lastRead: new Date()
      },
      create: {
        userId,
        novelId,
        chapterId,
        progress: progress || 0,
        lastRead: new Date()
      }
    });

    res.json(readingProgress);
  } catch (error) {
    console.error('updateReadingProgress error:', error);
    res.status(500).json({ message: 'Error updating reading progress', error });
  }
};

// Get Reading Progress for a Novel
export const getReadingProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

    if (!novelId) {
       res.status(400).json({ message: 'Novel ID is required' });
       return;
    }

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

    res.json(progress); // Returns null if not found, which is fine
  } catch (error) {
    console.error('getReadingProgress error:', error);
    res.status(500).json({ message: 'Error fetching reading progress', error });
  }
};
