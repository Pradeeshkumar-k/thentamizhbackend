"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementNovelView = exports.getChaptersByNovel = exports.deleteNovel = exports.updateNovel = exports.createNovel = exports.getNovelById = exports.getNovels = exports.invalidateNovelCache = void 0;
const prisma_1 = require("../utils/prisma");
const queue_1 = require("../utils/queue");
const jwt_1 = require("../utils/jwt");
// Helper to get userId from optional Authorization header
const getUserIdFromHeader = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return null;
    const token = authHeader.split(' ')[1];
    try {
        const payload = (0, jwt_1.decodeAccessToken)(token);
        return payload?.userId || payload?.id || null;
    }
    catch {
        return null;
    }
};
// Cache Invalidation (No-op as in-memory cache is removed)
const invalidateNovelCache = () => {
    // console.log('[Cache] Invalidation called (Cache Disabled)');
};
exports.invalidateNovelCache = invalidateNovelCache;
const getNovels = async (req, res) => {
    try {
        const limit = 20;
        const cursor = req.query.cursor;
        const search = req.query.search?.toString();
        const where = {
            status: 'PUBLISHED',
            // @ts-ignore
            deletedAt: null,
        };
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } }
            ];
        }
        console.log('[GET NOVELS] Starting request...');
        console.log('[GET NOVELS] limit:', limit);
        // Test Connection
        try {
            await prisma_1.prisma.$queryRaw `SELECT 1`;
            console.log('[GET NOVELS] DB Connection OK');
        }
        catch (dbError) {
            console.error('[GET NOVELS] DB Connection FAILED', dbError);
            throw dbError;
        }
        const novels = await prisma_1.prisma.novel.findMany({
            take: limit,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                titleEn: true,
                coverImageUrl: true,
                views: true,
                status: true,
                createdAt: true,
                author: { select: { name: true } },
                _count: { select: { chapters: true, likes: true, bookmarks: true } }
            },
        });
        const normalized = novels.map(n => {
            // ⚠️ Optimize: Prevent huge Base64 strings from crashing Vercel (Limit 4.5MB total response)
            let coverImage = n.coverImageUrl;
            if (coverImage && coverImage.startsWith('data:') && coverImage.length > 10240) { // > 10KB
                console.warn(`[Optimization] Dropping large Base64 cover for novel ${n.id} in list view`);
                coverImage = null; // Frontend will show placeholder
            }
            return {
                id: n.id,
                title: n.title,
                titleEn: n.titleEn,
                coverImage: coverImage,
                views: n.views || 0,
                createdAt: n.createdAt,
                authorName: n.author?.name ?? 'Unknown',
                totalChapters: n._count?.chapters || 0,
                likeCount: n._count?.likes || 0,
                status: n.status
            };
        });
        res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
        // 🔥 Controlled translation trigger (Queue/Fire-and-forget)
        novels.forEach(n => {
            if (!n.titleEn) {
                (0, queue_1.addTranslationJob)('novel', n.id);
            }
        });
        res.json({
            novels: normalized,
            nextCursor: novels.length ? novels[novels.length - 1].id : null,
            hasMore: novels.length === limit,
        });
    }
    catch (err) {
        console.error('[GET NOVELS ERROR]', err);
        console.error('[GET NOVELS STACK]', err.stack);
        res.status(500).json({
            message: 'Server error',
            error: String(err)
        });
    }
};
exports.getNovels = getNovels;
const getNovelById = async (req, res) => {
    const id = String(req.params.id);
    try {
        const userId = getUserIdFromHeader(req.headers.authorization);
        const novel = await prisma_1.prisma.novel.findFirst({
            where: {
                id,
                status: 'PUBLISHED',
                // @ts-ignore
                deletedAt: null
            },
            select: {
                id: true,
                title: true,
                titleEn: true,
                description: true,
                descriptionEn: true,
                genre: true,
                status: true,
                coverImageUrl: true,
                views: true,
                author: { select: { name: true } },
                chapters: {
                    orderBy: { order: 'asc' },
                    select: { id: true, title: true, titleEn: true, order: true, views: true }
                },
                _count: { select: { chapters: true, likes: true, bookmarks: true } },
                // Check if user has liked/bookmarked
                likes: userId ? { where: { userId }, select: { id: true } } : false,
                bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
            }
        });
        if (!novel) {
            return res.status(404).json({ message: "Not found" });
        }
        // DB views only
        const totalViews = novel.views || 0;
        if (!novel.titleEn || !novel.descriptionEn) {
            (0, queue_1.addTranslationJob)('novel', id);
        }
        // Normalize Data (Backend-side)
        const normalizedNovel = {
            ...novel,
            coverImage: novel.coverImageUrl,
            author: novel.author?.name || 'Unknown',
            authorName: novel.author?.name || 'Unknown',
            views: totalViews,
            totalChapters: novel._count?.chapters || 0,
            isLiked: userId ? novel.likes.length > 0 : false,
            isBookmarked: userId ? novel.bookmarks.length > 0 : false,
            likes: undefined, // Clear nested relations
            bookmarks: undefined
        };
        res.json(normalizedNovel);
    }
    catch (err) {
        console.error("GET NOVEL ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getNovelById = getNovelById;
// Admin: Create novel
const createNovel = async (req, res) => {
    const { title, description, novel_summary, genre, categories, coverImageUrl, cover_image, status, title_en, titleEn, summary_en, descriptionEn } = req.body;
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        const dbDescription = description || novel_summary;
        let dbGenre = genre;
        if (!dbGenre) {
            if (categories && Array.isArray(categories))
                dbGenre = categories.join(',');
            else if (categories)
                dbGenre = String(categories);
        }
        const dbCoverImage = coverImageUrl || cover_image;
        let dbStatus = status ? status.toUpperCase() : 'DRAFT';
        const novel = await prisma_1.prisma.novel.create({
            data: {
                title,
                titleEn: title_en || titleEn,
                description: dbDescription,
                descriptionEn: summary_en || descriptionEn,
                genre: dbGenre,
                coverImageUrl: dbCoverImage,
                status: dbStatus,
                authorId: req.user.userId,
            },
        });
        (0, exports.invalidateNovelCache)();
        res.status(201).json(novel);
    }
    catch (error) {
        console.error('createNovel error:', error);
        res.status(500).json({ message: 'Error creating novel', error: error.message });
    }
};
exports.createNovel = createNovel;
// Admin: Update novel
const updateNovel = async (req, res) => {
    const id = String(req.params.id);
    const { title, description, novel_summary, genre, categories, coverImageUrl, cover_image, status, title_en, titleEn, summary_en, descriptionEn } = req.body;
    try {
        const existing = await prisma_1.prisma.novel.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Novel not found' });
            return;
        }
        const dbData = {};
        if (title)
            dbData.title = title;
        if (description || novel_summary)
            dbData.description = description || novel_summary;
        if (genre)
            dbData.genre = genre;
        else if (categories && Array.isArray(categories))
            dbData.genre = categories.join(',');
        else if (categories)
            dbData.genre = String(categories);
        if (coverImageUrl || cover_image)
            dbData.coverImageUrl = coverImageUrl || cover_image;
        if (title_en || titleEn)
            dbData.titleEn = title_en || titleEn;
        if (summary_en || descriptionEn)
            dbData.descriptionEn = summary_en || descriptionEn;
        if (status)
            dbData.status = status.toUpperCase();
        const novel = await prisma_1.prisma.novel.update({
            where: { id },
            data: dbData,
        });
        (0, exports.invalidateNovelCache)();
        res.json({ success: true, data: novel });
    }
    catch (error) {
        console.error('updateNovel error:', error);
        res.status(500).json({ message: 'Error updating novel', error: error.message });
    }
};
exports.updateNovel = updateNovel;
// Admin: Delete novel
const deleteNovel = async (req, res) => {
    const id = String(req.params.id);
    try {
        res.status(202).json({ message: 'Deletion processing in background' });
        setImmediate(async () => {
            try {
                await prisma_1.prisma.novel.update({
                    where: { id },
                    data: {
                        status: 'DELETED',
                        // @ts-ignore
                        deletedAt: new Date()
                    }
                });
                (0, exports.invalidateNovelCache)();
                console.log(`[SOFT DELETE] Novel ${id} marked as deleted`);
            }
            catch (err) {
                console.error("[SOFT DELETE FAILED]", err);
            }
        });
    }
    catch (error) {
        console.error("DELETE NOVEL ERROR:", error);
        if (!res.headersSent)
            res.status(500).json({ message: 'Error deleting novel', error: error.message });
    }
};
exports.deleteNovel = deleteNovel;
// Public: Get chapters for a novel
const getChaptersByNovel = async (req, res) => {
    try {
        res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
        const id = String(req.params.id);
        const chapters = await prisma_1.prisma.chapter.findMany({
            where: { novelId: id },
            orderBy: { order: 'asc' },
            select: {
                id: true,
                title: true,
                titleEn: true,
                order: true,
                views: true,
                thumbnailUrl: true,
                createdAt: true,
                updatedAt: true
            }
        });
        const formattedChapters = chapters.map((ch) => ({
            _id: ch.id,
            id: ch.id,
            novelId: id,
            title: ch.title,
            titleEn: ch.titleEn,
            chapterNumber: ch.order,
            order: ch.order,
            views: ch.views || 0,
            thumbnail: ch.thumbnailUrl,
            createdAt: ch.createdAt,
            updatedAt: ch.updatedAt
        }));
        res.json({
            chapters: formattedChapters,
            success: true
        });
    }
    catch (error) {
        console.error('getChaptersByNovel error:', error);
        res.status(500).json({ message: 'Error fetching chapters', error });
    }
};
exports.getChaptersByNovel = getChaptersByNovel;
// Public: Increment view count for novel (REAL-TIME FIX)
// Public: Increment view count for novel (REAL-TIME FIX)
const incrementNovelView = async (req, res) => {
    const id = String(req.params.id);
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown';
    try {
        // Direct DB increment
        await prisma_1.prisma.novel.update({
            where: { id },
            data: { views: { increment: 1 } },
        });
        return res.status(204).end();
    }
    catch (error) {
        console.error("INCREMENT NOVEL VIEW ERROR:", error);
        // Don't fail the request
        res.status(204).end();
    }
};
exports.incrementNovelView = incrementNovelView;
