import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';
import { translateContent as performTranslation } from '../services/translationService';
// Import Cache Invalidation
import { invalidateNovelCache } from './novelController';


// ============================================
// DASHBOARD STATS
// ============================================

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalNovels, totalChapters, totalUsers, totalComments, totalSubscriptions] = await Promise.all([
      prisma.novel.count(),
      prisma.chapter.count(),
      prisma.user.count(),
      prisma.comment.count(),
      prisma.bookmark.count()
    ]);

    // Get recent activity (last 10 novels)
    const recentNovels = await prisma.novel.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        author: {
          select: { name: true }
        }
      }
    });

    const recentActivity = recentNovels.map((novel: any) => ({
      id: novel.id,
      action: `New novel "${novel.title}" by ${novel.author.name}`,
      timestamp: novel.createdAt.toISOString()
    }));

    res.json({
      success: true,
      data: {
        totalNovels,
        totalChapters,
        totalUsers,
        totalComments,
        totalSubscriptions,
        recentActivity
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error });
  }
};

// ============================================
// NOVEL MANAGEMENT
// ============================================

export const getAllNovelsAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status, page = 1, limit = 8 } = req.query;
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    if (status) {
      where.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [novels, total] = await Promise.all([
      prisma.novel.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          title: true,
          description: true,
          genre: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { chapters: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.novel.count({ where })
    ]);

    const formattedNovels = novels.map((novel: any) => ({
      id: novel.id,
      title: novel.title,
      author_name: novel.author.name,
      description: novel.description,
      genre: novel.genre,
      status: novel.status,
      // cover_image excluded for list view performance
      total_chapters: novel._count.chapters,
      created_at: novel.createdAt,
      updated_at: novel.updatedAt
    }));

    res.json({
      success: true,
      data: {
        novels: formattedNovels,
        total,
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching novels', error });
  }
};

export const getNovelByIdAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const novel = await prisma.novel.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        chapters: {
          select: { id: true, title: true, order: true }
        }
      }
    });

    if (!novel) {
      res.status(404).json({ success: false, error: 'Novel not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: novel.id,
        title: novel.title,
        author_name: novel.author.name,
        description: novel.description,
        genre: novel.genre,
        status: novel.status,
        cover_image: novel.coverImageUrl,
        chapters: novel.chapters,
        created_at: novel.createdAt,
        updated_at: novel.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching novel', error });
  }
};

export const createNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, novel_summary, genre, categories, status, cover_image, coverImageUrl } = req.body;
    const authorId = req.user?.userId;

    if (!authorId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Map frontend fields to backend schema
    const finalDescription = description || novel_summary || '';
    const finalGenre = Array.isArray(categories) ? categories.join(', ') : (genre || '');
    const finalStatus = (status || 'DRAFT').toUpperCase() as any;
    const finalCoverImageUrl = coverImageUrl || cover_image || '';

    const novel = await prisma.novel.create({
      data: {
        title,
        description: finalDescription,
        genre: finalGenre,
        status: finalStatus,
        coverImageUrl: finalCoverImageUrl,
        authorId
      }
    });

    // Invalidate Cache
    invalidateNovelCache();

    res.status(201).json({
      success: true,
      data: novel,
      message: 'Novel created successfully'
    });
  } catch (error) {
    console.error('Create novel error:', error);
    res.status(500).json({ message: 'Error creating novel', error });
  }
};

export const updateNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { title, description, novel_summary, genre, categories, status, cover_image, coverImageUrl } = req.body;

    // Map frontend fields to backend schema
    const finalDescription = description || novel_summary;
    const finalGenre = Array.isArray(categories) ? categories.join(', ') : genre;
    const finalStatus = status ? status.toUpperCase() : undefined;
    const finalCoverImageUrl = coverImageUrl || cover_image;

    const data: any = {};
    if (title) data.title = title;
    if (finalDescription !== undefined) data.description = finalDescription;
    if (finalGenre !== undefined) data.genre = finalGenre;
    if (finalStatus !== undefined) data.status = finalStatus;
    if (finalCoverImageUrl !== undefined) data.coverImageUrl = finalCoverImageUrl;

    const novel = await prisma.novel.update({
      where: { id },
      data
    });

    // CASCADE: If cover image is updated, update all chapters as well
    if (finalCoverImageUrl) {
      await prisma.chapter.updateMany({
        where: { novelId: id },
        data: { thumbnailUrl: finalCoverImageUrl }
      });
      console.log(`Updated cover image for all chapters of novel ${id}`);
    }

    // Invalidate Cache
    invalidateNovelCache();

    res.json({
      success: true,
      data: novel,
      message: 'Novel updated successfully'
    });
  } catch (error) {
    console.error('Update novel error:', error);
    res.status(500).json({ message: 'Error updating novel', error });
  }
};


export const deleteNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    await prisma.novel.delete({
      where: { id }
    });

    // Invalidate Cache
    invalidateNovelCache();

    res.json({
      success: true,
      message: 'Novel deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting novel', error });
  }
};

// ============================================
// CHAPTER MANAGEMENT
// ============================================

export const getChaptersByNovel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId } = req.params as { novelId: string };

    const chapters = await prisma.chapter.findMany({
      where: { novelId },
      orderBy: { order: 'asc' }
    });

    res.json({
      success: true,
      data: {
        chapters: chapters.map((ch: any) => ({
          id: ch.id,
          novel_id: ch.novelId,
          chapter_number: ch.order,
          title: ch.title,
          content: ch.content,
          thumbnail: ch.thumbnailUrl,
          created_at: ch.createdAt,
          updated_at: ch.updatedAt
        })),
        total: chapters.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chapters', error });
  }
};

export const getChapterById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const chapter = await prisma.chapter.findUnique({
      where: { id }
    });

    if (!chapter) {
      res.status(404).json({ success: false, error: 'Chapter not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: chapter.id,
        novel_id: chapter.novelId,
        chapter_number: chapter.order,
        title: chapter.title,
        content: chapter.content,
        thumbnail: chapter.thumbnailUrl,
        created_at: chapter.createdAt,
        updated_at: chapter.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chapter', error });
  }
};

export const createChapter = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novelId } = req.params as { novelId: string };
    const { title, name, content, chapter_number, order, thumbnail, thumbnailUrl } = req.body;

    // Map frontend fields (chapter_number, thumbnail, title/name)
    const finalOrder = order !== undefined ? order : (chapter_number !== undefined ? chapter_number : 1);
    const finalThumbnailUrl = thumbnailUrl || thumbnail || '';
    const finalTitle = title || name || `Chapter ${finalOrder}`;

    // Safeguard: Prevent operations on legacy numeric IDs that crash Prisma
    if (novelId && ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(String(novelId))) {
       res.status(400).json({ success: false, error: 'Legacy numeric IDs are read-only. Please use UUID novels.' });
       return;
    }

    const chapter = await prisma.chapter.create({
      data: {
        novelId,
        title: finalTitle,
        content: content || '',
        order: finalOrder,
        thumbnailUrl: finalThumbnailUrl
      }
    });

    res.status(201).json({
      success: true,
      data: chapter,
      message: 'Chapter created successfully'
    });
  } catch (error: any) {
    console.error('--- Admin Create Chapter ERROR ---');
    console.error('Data:', { novelId: req.params.novelId, body: req.body });
    console.error(error);
    res.status(500).json({ 
        message: 'Error creating chapter', 
        error_message: error.message,
        error_code: error.code
    });
  }
};

export const updateChapter = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { title, name, content, chapter_number, order, thumbnail, thumbnailUrl } = req.body;

    // Map frontend fields
    const finalOrder = order !== undefined ? order : (chapter_number !== undefined ? chapter_number : undefined);
    const finalThumbnailUrl = thumbnailUrl || thumbnail;
    const finalTitle = title || name;

    const data: any = {};
    if (finalTitle) data.title = finalTitle;
    if (content !== undefined) data.content = content;
    if (finalOrder !== undefined) data.order = finalOrder;
    if (finalThumbnailUrl !== undefined) data.thumbnailUrl = finalThumbnailUrl;

    const chapter = await prisma.chapter.update({
      where: { id },
      data
    });

    res.json({
      success: true,
      data: chapter,
      message: 'Chapter updated successfully'
    });
  } catch (error) {
    console.error('Update chapter error:', error);
    res.status(500).json({ message: 'Error updating chapter', error });
  }
};


export const deleteChapter = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    await prisma.chapter.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Chapter deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting chapter', error });
  }
};

// ============================================
// NOTIFICATIONS (Mock for now)
// ============================================

export const getAllNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // For now, return mock notifications
    // You can implement a real notification system later
    const notifications = [
      {
        id: '1',
        title: 'System Update',
        message: 'Admin dashboard is now live',
        type: 'info',
        read: false,
        created_at: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: notifications.filter(n => !n.read).length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error });
  }
};

export const markNotificationAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    
    // Mock implementation
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification', error });
  }
};

export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Mock implementation
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notifications', error });
  }
};

// ============================================
// TRANSLATION SERVICE
// ============================================

export const translateContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { text, targetLang = 'en' } = req.body;
    console.log('--- Translation Request ---');
    console.log('Target Lang:', targetLang);
    console.log('Text (first 50 chars):', text?.substring(0, 50));

    if (!text) {
      res.status(400).json({ success: false, error: 'Text is required for translation' });
      return;
    }

    const translatedText = await performTranslation(text, targetLang);
    console.log('Translation Success!');

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        targetLang
      }
    });
  } catch (error: any) {
    console.error('--- Translation ERROR Details ---');
    console.error('Text:', req.body.text?.substring(0, 100));
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to translate content',
      message: error.message,
      details: error.stack?.substring(0, 200)
    });
  }
};
