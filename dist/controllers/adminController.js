"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceDeleteDebug = exports.listAllDebug = exports.translateContent = exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getAllNotifications = exports.deleteChapter = exports.updateChapter = exports.createChapter = exports.getChapterById = exports.getChaptersByNovel = exports.deleteNovel = exports.updateNovel = exports.createNovel = exports.getNovelByIdAdmin = exports.getAllNovelsAdmin = exports.getDashboardStats = void 0;
const prisma_1 = require("../utils/prisma");
const translationService_1 = require("../services/translationService");
// Import Cache Invalidation
const novelController_1 = require("./novelController");
// ============================================
// DASHBOARD STATS
// ============================================
const getDashboardStats = async (req, res) => {
    try {
        const [totalNovels, totalChapters, totalUsers, totalComments, totalSubscriptions] = await Promise.all([
            prisma_1.prisma.novel.count(),
            prisma_1.prisma.chapter.count(),
            prisma_1.prisma.user.count(),
            prisma_1.prisma.comment.count(),
            prisma_1.prisma.bookmark.count()
        ]);
        // Get recent activity (last 10 novels)
        const recentNovels = await prisma_1.prisma.novel.findMany({
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
        const recentActivity = recentNovels.map((novel) => ({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching dashboard stats', error });
    }
};
exports.getDashboardStats = getDashboardStats;
// ============================================
// NOVEL MANAGEMENT
// ============================================
const getAllNovelsAdmin = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 8 } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (status) {
            where.status = status;
        }
        else {
            // Default: Exclude DELETED novels from list
            where.status = { not: 'DELETED' };
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [novels, total] = await Promise.all([
            prisma_1.prisma.novel.findMany({
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
            prisma_1.prisma.novel.count({ where })
        ]);
        const formattedNovels = novels.map((novel) => ({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching novels', error });
    }
};
exports.getAllNovelsAdmin = getAllNovelsAdmin;
const getNovelByIdAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const novel = await prisma_1.prisma.novel.findUnique({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching novel', error });
    }
};
exports.getNovelByIdAdmin = getNovelByIdAdmin;
const createNovel = async (req, res) => {
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
        const finalStatus = (status || 'DRAFT').toUpperCase();
        const finalCoverImageUrl = coverImageUrl || cover_image || '';
        const novel = await prisma_1.prisma.novel.create({
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
        (0, novelController_1.invalidateNovelCache)();
        res.status(201).json({
            success: true,
            data: novel,
            message: 'Novel created successfully'
        });
    }
    catch (error) {
        console.error('Create novel error:', error);
        res.status(500).json({ message: 'Error creating novel', error });
    }
};
exports.createNovel = createNovel;
const updateNovel = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, novel_summary, genre, categories, status, cover_image, coverImageUrl } = req.body;
        // Map frontend fields to backend schema
        const finalDescription = description || novel_summary;
        const finalGenre = Array.isArray(categories) ? categories.join(', ') : genre;
        const finalStatus = status ? status.toUpperCase() : undefined;
        const finalCoverImageUrl = coverImageUrl || cover_image;
        const data = {};
        if (title)
            data.title = title;
        if (finalDescription !== undefined)
            data.description = finalDescription;
        if (finalGenre !== undefined)
            data.genre = finalGenre;
        if (finalStatus !== undefined)
            data.status = finalStatus;
        if (finalCoverImageUrl !== undefined)
            data.coverImageUrl = finalCoverImageUrl;
        const novel = await prisma_1.prisma.novel.update({
            where: { id },
            data
        });
        // CASCADE: If cover image is updated, update all chapters as well
        if (finalCoverImageUrl) {
            await prisma_1.prisma.chapter.updateMany({
                where: { novelId: id },
                data: { thumbnailUrl: finalCoverImageUrl }
            });
            console.log(`Updated cover image for all chapters of novel ${id}`);
        }
        // Invalidate Cache
        (0, novelController_1.invalidateNovelCache)();
        res.json({
            success: true,
            data: novel,
            message: 'Novel updated successfully'
        });
    }
    catch (error) {
        console.error('Update novel error:', error);
        res.status(500).json({ message: 'Error updating novel', error });
    }
};
exports.updateNovel = updateNovel;
const deleteNovel = async (req, res) => {
    try {
        await prisma_1.prisma.novel.update({
            where: { id: String(req.params.id) },
            data: {
                status: 'DELETED',
                // @ts-ignore
                deletedAt: new Date()
            }
        });
        res.status(200).json({ message: 'Novel deleted successfully' });
    }
    catch (err) {
        console.error('[DELETE NOVEL ERROR]', err);
        res.status(500).json({ message: 'Delete failed' });
    }
};
exports.deleteNovel = deleteNovel;
// ============================================
// CHAPTER MANAGEMENT
// ============================================
const getChaptersByNovel = async (req, res) => {
    try {
        const { novelId } = req.params;
        const chapters = await prisma_1.prisma.chapter.findMany({
            where: { novelId },
            orderBy: { order: 'asc' }
        });
        res.json({
            success: true,
            data: {
                chapters: chapters.map((ch) => ({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching chapters', error });
    }
};
exports.getChaptersByNovel = getChaptersByNovel;
const getChapterById = async (req, res) => {
    try {
        const { id } = req.params;
        const chapter = await prisma_1.prisma.chapter.findUnique({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching chapter', error });
    }
};
exports.getChapterById = getChapterById;
const createChapter = async (req, res) => {
    try {
        const { novelId } = req.params;
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
        const chapter = await prisma_1.prisma.chapter.create({
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
    }
    catch (error) {
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
exports.createChapter = createChapter;
const updateChapter = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, name, content, chapter_number, order, thumbnail, thumbnailUrl } = req.body;
        // Map frontend fields
        const finalOrder = order !== undefined ? order : (chapter_number !== undefined ? chapter_number : undefined);
        const finalThumbnailUrl = thumbnailUrl || thumbnail;
        const finalTitle = title || name;
        const data = {};
        if (finalTitle)
            data.title = finalTitle;
        if (content !== undefined)
            data.content = content;
        if (finalOrder !== undefined)
            data.order = finalOrder;
        if (finalThumbnailUrl !== undefined)
            data.thumbnailUrl = finalThumbnailUrl;
        const chapter = await prisma_1.prisma.chapter.update({
            where: { id },
            data
        });
        res.json({
            success: true,
            data: chapter,
            message: 'Chapter updated successfully'
        });
    }
    catch (error) {
        console.error('Update chapter error:', error);
        res.status(500).json({ message: 'Error updating chapter', error });
    }
};
exports.updateChapter = updateChapter;
const deleteChapter = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.chapter.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Chapter not found' });
            return;
        }
        // Manual Cascade Delete (Sequential - No Transaction)
        // 1. Delete Dependencies
        await prisma_1.prisma.comment.deleteMany({ where: { chapterId: id } });
        await prisma_1.prisma.like.deleteMany({ where: { chapterId: id } });
        await prisma_1.prisma.readingProgress.deleteMany({ where: { chapterId: id } });
        // 2. Delete Chapter
        await prisma_1.prisma.chapter.delete({ where: { id } });
        res.json({
            success: true,
            message: 'Chapter deleted successfully'
        });
    }
    catch (error) {
        console.error("ADMIN DELETE CHAPTER ERROR:", error);
        res.status(500).json({ message: 'Error deleting chapter', error: error.message });
    }
};
exports.deleteChapter = deleteChapter;
// ============================================
// NOTIFICATIONS (Mock for now)
// ============================================
const getAllNotifications = async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error });
    }
};
exports.getAllNotifications = getAllNotifications;
const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        // Mock implementation
        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error marking notification', error });
    }
};
exports.markNotificationAsRead = markNotificationAsRead;
const markAllNotificationsAsRead = async (req, res) => {
    try {
        // Mock implementation
        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error marking notifications', error });
    }
};
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
// ============================================
// TRANSLATION SERVICE
// ============================================
const translateContent = async (req, res) => {
    try {
        const { text, targetLang = 'en' } = req.body;
        console.log('--- Translation Request ---');
        console.log('Target Lang:', targetLang);
        console.log('Text (first 50 chars):', text?.substring(0, 50));
        if (!text) {
            res.status(400).json({ success: false, error: 'Text is required for translation' });
            return;
        }
        const translatedText = await (0, translationService_1.translateContent)(text, targetLang);
        console.log('Translation Success!');
        res.json({
            success: true,
            data: {
                originalText: text,
                translatedText,
                targetLang
            }
        });
    }
    catch (error) {
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
exports.translateContent = translateContent;
// ============================================
// DEBUG TOOLS (Temporary)
// ============================================
const listAllDebug = async (req, res) => {
    try {
        const novels = await prisma_1.prisma.novel.findMany({ select: { id: true, title: true, status: true, authorId: true } });
        res.json({ count: novels.length, novels });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.listAllDebug = listAllDebug;
const forceDeleteDebug = async (req, res) => {
    const { id } = req.params;
    const logs = [];
    const log = (msg) => logs.push(msg);
    try {
        log(`Starting Force Delete for ${id}`);
        // 1. Reading Progress
        const rp = await prisma_1.prisma.readingProgress.deleteMany({ where: { novelId: id } });
        log(`Deleted ${rp.count} ReadingProgress records`);
        // 2. Bookmarks
        const bk = await prisma_1.prisma.bookmark.deleteMany({ where: { novelId: id } });
        log(`Deleted ${bk.count} Bookmarks`);
        // 3. Novel Likes
        const nl = await prisma_1.prisma.novelLike.deleteMany({ where: { novelId: id } });
        log(`Deleted ${nl.count} NovelLikes`);
        // 4. Get Chapters
        const chapters = await prisma_1.prisma.chapter.findMany({ where: { novelId: id }, select: { id: true } });
        log(`Found ${chapters.length} chapters`);
        const chIds = chapters.map(c => c.id);
        if (chIds.length > 0) {
            // 5. Chapter Children
            const cm = await prisma_1.prisma.comment.deleteMany({ where: { chapterId: { in: chIds } } });
            log(`Deleted ${cm.count} Comments`);
            const cl = await prisma_1.prisma.like.deleteMany({ where: { chapterId: { in: chIds } } });
            log(`Deleted ${cl.count} ChapterLikes`);
            // Extra safety for ReadingProgress by chapter if any stray ones exist
            const rpCh = await prisma_1.prisma.readingProgress.deleteMany({ where: { chapterId: { in: chIds } } });
            log(`Deleted ${rpCh.count} stray ReadingProgress by Chapter`);
            // 6. Delete Chapters
            const chDel = await prisma_1.prisma.chapter.deleteMany({ where: { novelId: id } });
            log(`Deleted ${chDel.count} Chapters`);
        }
        // 7. Delete Novel
        const nDel = await prisma_1.prisma.novel.delete({ where: { id } });
        log(`Deleted Novel: ${nDel.title}`);
        (0, novelController_1.invalidateNovelCache)();
        res.json({ success: true, logs });
    }
    catch (e) {
        log(`ERROR: ${e.message}`);
        res.status(500).json({ success: false, logs, error: e.message });
    }
};
exports.forceDeleteDebug = forceDeleteDebug;
