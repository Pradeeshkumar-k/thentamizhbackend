"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChaptersByNovel = exports.deleteNovel = exports.updateNovel = exports.createNovel = exports.getNovelById = exports.warmUpCache = exports.getNovels = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const translationService_1 = require("../services/translationService");
// Simple In-Memory Cache for Novel List
let novelListCache = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 Hour TTL
// Public: Get all novels
const getNovels = async (req, res) => {
    const { page = 1, limit = 10, search, sort } = req.query;
    console.log(`[getNovels] Request: page=${page} limit=${limit} search=${search}`);
    try {
        const where = {};
        if (search) {
            where.OR = [
                { title: { contains: String(search), mode: 'insensitive' } },
                { description: { contains: String(search), mode: 'insensitive' } },
            ];
        }
        // Optimization: Check Cache (Only if no search filters)
        if (!search && novelListCache && (Date.now() - novelListCache.timestamp < CACHE_TTL)) {
            console.log('[getNovels] Serving from Cache ⚡');
            const cachedNovels = novelListCache.data;
            res.json({
                novels: cachedNovels,
                total: 100, // Dummy
                page: Number(page),
                limit: Number(limit)
            });
            return;
        }
        const skip = (Number(page) - 1) * Number(limit);
        console.log(`[getNovels] Querying DB: take=${limit} skip=${skip}`);
        console.time("db_findMany_novels");
        const novels = await prisma_1.default.novel.findMany({
            where,
            take: Number(limit),
            skip,
            select: {
                id: true,
                title: true,
                genre: true,
                status: true,
                coverImageUrl: true,
                views: true,
                createdAt: true,
                updatedAt: true,
                author: { select: { name: true, email: true } },
                _count: { select: { chapters: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.timeEnd("db_findMany_novels");
        console.log(`[getNovels] DB returned ${novels.length} Items`);
        // Removed Total Count Query for Speed
        const total = 100;
        // Map to frontend expected format
        const formattedNovels = novels.map(novel => ({
            _id: novel.id,
            id: novel.id,
            title: novel.title,
            // description: novel.description, // Removed
            genre: novel.genre,
            status: novel.status,
            coverImage: novel.coverImageUrl,
            author: novel.author.name || novel.author.email.split('@')[0],
            totalChapters: novel._count?.chapters || 0,
            stats: {
                views: novel.views,
                likes: 0,
                bookmarks: 0
            },
            createdAt: novel.createdAt,
            updatedAt: novel.updatedAt
        }));
        // Set Cache (if no search)
        if (!search) {
            novelListCache = {
                data: formattedNovels,
                timestamp: Date.now()
            };
            console.log('[getNovels] Cache Updated');
        }
        res.json({
            novels: formattedNovels,
            total,
            page: Number(page),
            limit: Number(limit)
        });
    }
    catch (error) {
        console.error('getNovels error DETAILS:', error);
        res.status(500).json({ message: 'Error fetching novels', error: error.message });
    }
};
exports.getNovels = getNovels;
// Internal Warmup Function
const warmUpCache = async () => {
    console.log('[Cache Warmup] Starting...');
    try {
        const novels = await prisma_1.default.novel.findMany({
            take: 100, // Pre-warm standard limit
            select: {
                id: true,
                title: true,
                genre: true,
                status: true,
                coverImageUrl: true,
                views: true,
                createdAt: true,
                updatedAt: true,
                author: { select: { name: true, email: true } },
                _count: { select: { chapters: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        const formattedNovels = novels.map(novel => ({
            _id: novel.id,
            id: novel.id,
            title: novel.title,
            genre: novel.genre,
            status: novel.status,
            coverImage: novel.coverImageUrl,
            author: novel.author.name || novel.author.email.split('@')[0],
            totalChapters: novel._count?.chapters || 0,
            stats: {
                views: novel.views,
                likes: 0,
                bookmarks: 0
            },
            createdAt: novel.createdAt,
            updatedAt: novel.updatedAt
        }));
        novelListCache = {
            data: formattedNovels,
            timestamp: Date.now()
        };
        console.log(`[Cache Warmup] Success! ${novels.length} novels cached.`);
    }
    catch (e) {
        console.error('[Cache Warmup] Failed', e);
    }
};
exports.warmUpCache = warmUpCache;
// Cache for Single Novels (ID -> { data, timestamp })
const novelCache = new Map();
const NOVEL_CACHE_TTL = 60 * 60 * 1000; // 1 Hour TTL
// Public: Get novel by ID
const getNovelById = async (req, res) => {
    const { id } = req.params;
    const { lang } = req.query; // Support lang=english query param
    // Cache Key includes Lang to cache translations separately
    const cacheKey = `${id}-${lang || 'default'}`;
    try {
        // 1. Check Cache
        const cached = novelCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < NOVEL_CACHE_TTL)) {
            console.log(`[getNovelById] Serving ${id} from Cache ⚡`);
            // Fire-and-forget view increment even for cached hits to maintain stats accuracy
            prisma_1.default.novel.update({
                where: { id },
                data: { views: { increment: 1 } },
            }).catch(e => console.error("Async View Inc Failed", e));
            // Wrap cached data to match API contract
            res.json({
                novel: cached.data,
                chapters: []
            });
            return;
        }
        const novel = await prisma_1.default.novel.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        // profileImage: true, // Removed: Field does not exist in schema
                    }
                },
                chapters: {
                    orderBy: { order: 'asc' },
                    select: {
                        id: true,
                        title: true, // Needed for list
                        order: true,
                        createdAt: true,
                        titleEn: true // Include English Title
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        bookmarks: true,
                    }
                }
            }
        });
        if (!novel) {
            res.status(404).json({ message: 'Novel not found' });
            return;
        }
        // Lazy Translation Logic (Parallel & Background Save from previous step retained)
        // NOTE: The previous translation logic modified the `novel` object in place.
        // We will keep that logic.
        if (lang === 'english') {
            console.log('[getNovelById] English requested. Checking translations...');
            let needsUpdate = false;
            const updates = {};
            const translationTasks = [];
            // Check Title
            if (!novel.titleEn && novel.title) {
                translationTasks.push(translationService_1.TranslationService.translateTextOrNull(novel.title)
                    .then((res) => ({ type: 'title', value: res }))
                    .catch((e) => { console.error("Title translation failed", e); return { type: 'title', value: null }; }));
            }
            // Check Description
            if (!novel.descriptionEn && novel.description) {
                translationTasks.push(translationService_1.TranslationService.translateTextOrNull(novel.description)
                    .then((res) => ({ type: 'description', value: res }))
                    .catch((e) => { console.error("Description translation failed", e); return { type: 'description', value: null }; }));
            }
            if (translationTasks.length > 0) {
                console.log(`[getNovelById] executing ${translationTasks.length} translation tasks in parallel...`);
                const results = await Promise.all(translationTasks);
                for (const result of results) {
                    if (result.type === 'title' && result.value) {
                        novel.titleEn = result.value;
                        updates.titleEn = result.value;
                        needsUpdate = true;
                        console.log(`[getNovelById] Title Translated`);
                    }
                    else if (result.type === 'description' && result.value) {
                        novel.descriptionEn = result.value;
                        updates.descriptionEn = result.value;
                        needsUpdate = true;
                        console.log(`[getNovelById] Desc Translated`);
                    }
                }
            }
            else {
                console.log('[getNovelById] No translations needed (already cached or source missing).');
            }
            // Persist translations if any
            if (needsUpdate) {
                prisma_1.default.novel.update({
                    where: { id },
                    data: updates
                }).then(() => console.log('[getNovelById] Translations cached to DB'))
                    .catch(err => console.error('Failed to save translations', err));
            }
        }
        // Increment view count (ASYNC - Non-blocking)
        prisma_1.default.novel.update({
            where: { id },
            data: { views: { increment: 1 } },
        }).catch(err => console.error('Error incrementing views:', err));
        // Force cast to any to avoid type errors with includes
        const n = novel;
        const formattedNovel = {
            ...n,
            _id: n.id,
            id: n.id,
            title: n.title,
            titleEn: n.titleEn,
            description: n.description,
            descriptionEn: n.descriptionEn,
            genre: n.genre, // fallback if no category
            status: n.status,
            // coverImage: n.coverImageUrl, // Original line seems to expect coverImageUrl on model
            coverImage: n.coverImageUrl,
            author: n.author?.name || n.author?.email?.split('@')[0] || 'Unknown',
            chapters: n.chapters ? n.chapters.map((c) => ({
                ...c,
                title: c.title,
                titleEn: c.titleEn
            })) : [],
            // comments: n.comments, // Removed: Field does not exist in schema
            tags: ['Fiction', 'Romance', 'Tamil'], // Dummy tags to prevent frontend issues if expected
            stats: {
                views: n.views, // Note: This is pre-increment value, fine for cache
                likes: n._count?.likes || 0,
                bookmarks: n._count?.bookmarks || 0
            }
        };
        // Update Cache
        novelCache.set(cacheKey, { data: formattedNovel, timestamp: Date.now() });
        res.json({
            novel: formattedNovel,
            chapters: []
        });
    }
    catch (error) {
        console.error('getNovelById error:', error);
        res.status(500).json({ message: 'Error fetching novel', error });
    }
};
exports.getNovelById = getNovelById;
// Admin: Create novel
const createNovel = async (req, res) => {
    const { title, description, genre, coverImageUrl, status } = req.body;
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        const novel = await prisma_1.default.novel.create({
            data: {
                title,
                description,
                genre,
                coverImageUrl,
                status: status || 'DRAFT',
                authorId: req.user.userId,
            },
        });
        res.status(201).json(novel);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating novel', error });
    }
};
exports.createNovel = createNovel;
// Admin: Update novel
const updateNovel = async (req, res) => {
    const { id } = req.params;
    const { title, description, genre, coverImageUrl, status } = req.body;
    try {
        const existing = await prisma_1.default.novel.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Novel not found' });
            return;
        }
        const novel = await prisma_1.default.novel.update({
            where: { id },
            data: { title, description, genre, coverImageUrl, status },
        });
        res.json(novel);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating novel', error });
    }
};
exports.updateNovel = updateNovel;
// Admin: Delete novel
const deleteNovel = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await prisma_1.default.novel.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Novel not found' });
            return;
        }
        await prisma_1.default.novel.delete({ where: { id } });
        res.json({ message: 'Novel deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting novel', error });
    }
};
exports.deleteNovel = deleteNovel;
// Public: Get chapters for a novel
const getChaptersByNovel = async (req, res) => {
    try {
        const { id } = req.params; // Expecting novelId as :id for consistency with other public routes or :novelId
        const chapters = await prisma_1.default.chapter.findMany({
            where: { novelId: id },
            orderBy: { order: 'asc' },
            select: {
                id: true,
                title: true,
                titleEn: true, // Include English Title
                order: true,
                views: true,
                // thumbnailUrl: true, // Excluded for performance
                createdAt: true,
                updatedAt: true
                // Exclude content for list view
            }
        });
        // Map to frontend expected format
        const formattedChapters = chapters.map(ch => ({
            _id: ch.id,
            id: ch.id,
            novelId: id,
            title: ch.title,
            titleEn: ch.titleEn, // Include English Title
            chapterNumber: ch.order,
            order: ch.order,
            views: ch.views,
            // thumbnail: ch.thumbnailUrl, // Excluded for performance
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
