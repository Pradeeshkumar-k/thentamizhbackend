import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prismaRead } from '../utils/prismaRead';
import { prismaWrite } from '../utils/prismaWrite';

// User: Add comment
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { chapterId, text } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const comment = await prismaWrite.comment.create({
      data: {
        text,
        chapterId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Error adding comment', error });
  }
};

// Admin/Owner: Delete comment
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user?.userId;
  const role = req.user?.role;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const comment = await prismaRead.comment.findUnique({ where: { id } });
    
    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    // Allow deletion if Admin OR if user owns the comment
    if (role !== 'ADMIN' && comment.userId !== userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await prismaWrite.comment.delete({ where: { id } });
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting comment', error });
  }
};

// Public: Get comments for a chapter
export const getCommentsByChapter = async (req: AuthRequest, res: Response): Promise<void> => {
  const chapterId = String(req.params.id);
  const cursor = Number(req.query.cursor || 0);
  const limit = 20;

  try {
    const comments = await prismaRead.comment.findMany({
      where: { chapterId },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: cursor,
      take: limit
    });
    
    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching comments', error });
  }
};
