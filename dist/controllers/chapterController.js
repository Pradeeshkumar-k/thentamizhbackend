"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementChapterView = exports.unlikeChapter = exports.likeChapter = exports.deleteChapter = exports.updateChapter = exports.createChapter = exports.getChapterById = void 0;
const prisma_1 = require("../utils/prisma");
const queue_1 = require("../utils/queue");
const jwt_1 = require("../utils/jwt");
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
                views: true
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
        res.json({
            ...chapter,
            views: chapter.views || 0,
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
    const { novelId, title, content, order, thumbnailUrl } = req.body;
    try {
        const chapter = await prisma_1.prisma.chapter.create({
            data: {
                novelId,
                title,
                content,
                order,
                thumbnailUrl
            },
        });
        res.status(201).json(chapter);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating chapter', error: error.message });
    }
};
exports.createChapter = createChapter;
// Admin: Update chapter
const updateChapter = async (req, res) => {
    const { id } = req.params;
    const { title, content, order, thumbnailUrl } = req.body;
    try {
        const existing = await prisma_1.prisma.chapter.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Chapter not found' });
            return;
        }
        const chapter = await prisma_1.prisma.chapter.update({
            where: { id },
            data: { title, content, order, thumbnailUrl },
        });
        res.json(chapter);
    }
    catch (error) {
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
        });
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
// Public: Increment view count for chapter (REAL-TIME FIX)
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
        // 1️⃣ Dedup (24h)
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
            // Direct DB increment
            await prisma_1.prisma.chapter.update({
                where: { id: chapterId },
                data: { views: { increment: 1 } },
            });
            // 3️⃣ Fire-and-forget history log
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
