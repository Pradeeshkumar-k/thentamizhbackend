"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementChapterView = exports.unlikeChapter = exports.likeChapter = exports.deleteChapter = exports.updateChapter = exports.createChapter = exports.getChapterById = void 0;
const prisma_1 = require("../utils/prisma");
const jwt_1 = require("../utils/jwt");
const redis_1 = require("../utils/redis");
const novelController_1 = require("./novelController");
const queue_1 = require("../utils/queue");
// Public: Get chapter content
// 🚀 FAST & SAFE - READ ONLY
const getChapterById = async (req, res) => {
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
                const payload = (0, jwt_1.decodeAccessToken)(authHeader.split(' ')[1]);
                userId = payload?.userId || payload?.id || null;
            }
            catch { }
        }
        const chapter = await prisma_1.prisma.chapter.findUnique({
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
                isTranslating: true,
                views: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!chapter) {
            res.status(404).json({ message: "Chapter not found" });
            return;
        }
        // 🔥 Asynchronous English Translation (Non-blocking)
        if (lang === 'english' && !chapter.contentEn) {
            // Trigger background translation job
            (0, queue_1.addTranslationJob)('chapter', chapterId);
        }
        const redisCount = await (0, redis_1.getRedisViewCount)('chapter', chapterId);
        res.json({
            ...chapter,
            views: (chapter.views || 0) + redisCount,
            chapterNumber: chapter.order,
            likeCount: chapter._count?.likes ?? 0,
            likedByMe: userId
                ? chapter.likes?.some((l) => l.userId === userId)
                : false
        });
    }
    catch (error) {
        console.error("getChapterById error:", error);
        res.status(500).json({ message: "Error fetching chapter" });
    }
};
exports.getChapterById = getChapterById;
// Admin: Create chapter
const createChapter = async (req, res) => {
    const { novelId, title, titleEn, title_en, content, contentEn, content_en, order, thumbnailUrl } = req.body;
    const finalTitleEn = titleEn || title_en;
    const finalContentEn = contentEn || content_en;
    try {
        const chapter = await prisma_1.prisma.chapter.create({
            data: {
                novelId,
                title,
                titleEn: finalTitleEn,
                content,
                contentEn: finalContentEn,
                order,
                thumbnailUrl,
                isTranslating: !!finalContentEn ? false : undefined // If contentEn provided, not translating
            },
        });
        // Bump Novel updatedAt
        await prisma_1.prisma.novel.update({
            where: { id: novelId },
            data: { updatedAt: new Date() }
        });
        // Invalidate cache to update chapter count on novel list
        await (0, novelController_1.invalidateNovelCache)();
        res.status(201).json(chapter);
    }
    catch (error) {
        console.error("CREATE CHAPTER ERROR:", error);
        res.status(500).json({ message: 'Error creating chapter', error: error.message });
    }
};
exports.createChapter = createChapter;
// Admin: Update chapter
const updateChapter = async (req, res) => {
    const { id } = req.params;
    const { title, titleEn, title_en, content, contentEn, content_en, order, thumbnailUrl } = req.body;
    const finalTitleEn = titleEn || title_en;
    const finalContentEn = contentEn || content_en;
    console.log(`[UPDATE CHAPTER] ID: ${id}, TitleEn: ${finalTitleEn ? 'YES' : 'NO'}, ContentEn: ${finalContentEn ? 'YES' : 'NO'}`);
    try {
        const existing = await prisma_1.prisma.chapter.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Chapter not found' });
            return;
        }
        const chapter = await prisma_1.prisma.chapter.update({
            where: { id },
            data: {
                title,
                titleEn: finalTitleEn,
                content,
                contentEn: finalContentEn,
                order,
                thumbnailUrl,
                isTranslating: !!finalContentEn ? false : undefined // Force false if content provided
            },
        });
        // Bump Novel updatedAt
        await prisma_1.prisma.novel.update({
            where: { id: chapter.novelId },
            data: { updatedAt: new Date() }
        });
        // Invalidate novel list cache
        await (0, novelController_1.invalidateNovelCache)();
        res.json(chapter);
    }
    catch (error) {
        console.error("UPDATE CHAPTER ERROR:", error);
        res.status(500).json({ message: 'Error updating chapter', error: error.message });
    }
};
exports.updateChapter = updateChapter;
// Admin: Delete chapter
const deleteChapter = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await prisma_1.prisma.chapter.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Chapter not found' });
            return;
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.comment.deleteMany({ where: { chapterId: id } });
            await tx.like.deleteMany({ where: { chapterId: id } });
            await tx.readingProgress.deleteMany({ where: { chapterId: id } });
            await tx.chapter.delete({ where: { id } });
            // Bump Novel updatedAt
            await tx.novel.update({
                where: { id: existing.novelId },
                data: { updatedAt: new Date() }
            });
        });
        await (0, novelController_1.invalidateNovelCache)();
        res.json({ message: 'Chapter deleted successfully' });
    }
    catch (error) {
        console.error("DELETE CHAPTER ERROR:", error);
        res.status(500).json({ message: 'Error deleting chapter', error: error.message });
    }
};
exports.deleteChapter = deleteChapter;
// User: Like chapter
const likeChapter = async (req, res) => {
    const id = String(req.params.id);
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    await prisma_1.prisma.like.upsert({
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
exports.likeChapter = likeChapter;
// User: Unlike chapter
const unlikeChapter = async (req, res) => {
    const id = String(req.params.id);
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        await prisma_1.prisma.like.delete({
            where: {
                chapterId_userId: {
                    chapterId: id,
                    userId,
                },
            },
        });
        res.json({ message: 'Chapter unliked' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error unliking chapter', error: error.message });
    }
};
exports.unlikeChapter = unlikeChapter;
// Public: Increment view count for chapter (BUFFERED via Redis)
const incrementChapterView = async (req, res) => {
    const chapterId = String(req.params.id);
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown';
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const payload = (0, jwt_1.decodeAccessToken)(authHeader.split(' ')[1]);
            userId = payload?.userId || payload?.id || null;
        }
        catch { }
    }
    try {
        // 1️⃣ Dedup (24h) via DB (Read-only check, acceptable)
        // Optimization: Could move dedup to Redis too, but keeping DB for persistent history log logic
        const exists = await prisma_1.prisma.chapterView.findFirst({
            where: {
                chapterId,
                OR: [
                    userId ? { userId } : undefined,
                    { ip }
                ].filter(Boolean),
                viewedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });
        if (!exists) {
            // 2️⃣ Increment in Redis (No DB Lock)
            await (0, redis_1.incrementViewCount)('chapter', chapterId);
            // 3️⃣ Fire-and-forget history log (Insert is faster than Update, but still hits DB)
            // Ideally this should also be buffered or queued.
            prisma_1.prisma.chapterView.create({
                data: { chapterId, userId, ip }
            }).catch(console.error);
        }
        return res.status(204).end();
    }
    catch (err) {
        console.error("incrementChapterView error:", err);
        return res.status(204).end();
    }
};
exports.incrementChapterView = incrementChapterView;
