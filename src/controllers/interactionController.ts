import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prismaRead } from '../utils/prismaRead';
import { prismaWrite } from '../utils/prismaWrite';

// Like a Novel
export const likeNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!novelId) {
      res.status(400).json({ message: 'Novel ID is required' });
      return;
    }

    // Check if already liked
    const existingLike = await prismaRead.novelLike.findUnique({
      where: {
        userId_novelId: {
          userId,
          novelId
        }
      }
    });

    if (existingLike) {
      res.status(200).json({ message: 'Novel already liked' });
      return;
    }

    // Create like
    await prismaWrite.novelLike.create({
      data: {
        userId,
        novelId
      }
    });

    res.status(200).json({ message: 'Novel liked successfully', success: true });
  } catch (error) {
    console.error('likeNovel error:', error);
    res.status(500).json({ message: 'Error liking novel', error });
  }
};

// Unlike a Novel
export const unlikeNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!novelId) {
      res.status(400).json({ message: 'Novel ID is required' });
      return;
    }

    await prismaWrite.novelLike.deleteMany({
      where: {
        userId,
        novelId
      }
    });

    res.status(200).json({ message: 'Novel unliked successfully', success: true });
  } catch (error) {
    console.error('unlikeNovel error:', error);
    res.status(500).json({ message: 'Error unliking novel', error });
  }
};

// Bookmark a Novel
export const bookmarkNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!novelId) {
      res.status(400).json({ message: 'Novel ID is required' });
      return;
    }

    // Check if already bookmarked
    const existingBookmark = await prismaRead.bookmark.findUnique({
      where: {
        userId_novelId: {
          userId,
          novelId
        }
      }
    });

    if (existingBookmark) {
      res.status(200).json({ message: 'Novel already bookmarked' });
      return;
    }

    // Create bookmark
    await prismaWrite.bookmark.create({
      data: {
        userId,
        novelId
      }
    });

    res.status(200).json({ message: 'Novel bookmarked successfully', success: true });
  } catch (error) {
    console.error('bookmarkNovel error:', error);
    res.status(500).json({ message: 'Error bookmarking novel', error });
  }
};

// Remove Bookmark (Toggle)
// Note: Frontend currently sends DELETE request to /bookmark with body { novelId }
export const removeBookmark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // For DELETE requests with JSON body, use req.body. 
    // Ideally this should probably be DELETE /novels/:id/bookmark, but sticking to frontend spec.
    const { novelId } = req.body; 
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!novelId) {
      res.status(400).json({ message: 'Novel ID is required' });
      return;
    }

    await prismaWrite.bookmark.deleteMany({
      where: {
        userId,
        novelId
      }
    });

    res.status(200).json({ message: 'Bookmark removed successfully', success: true });
  } catch (error) {
    console.error('removeBookmark error:', error);
    res.status(500).json({ message: 'Error removing bookmark', error });
  }
};

// Get Bookmarked Novels
export const getBookmarkedNovels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const bookmarks = await prismaRead.bookmark.findMany({
      where: { userId },
      include: {
        novel: {
          select: {
            id: true,
            title: true,
            coverImageUrl: true,
            author: { select: { name: true } },
            genre: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const novels = bookmarks.map(b => ({
        ...b.novel,
        bookmarks: undefined // clear nested
    }));

    res.json({ success: true, data: novels });
  } catch (error) {
    console.error('getBookmarkedNovels error:', error);
    res.status(500).json({ message: 'Error fetching library', error });
  }
};
