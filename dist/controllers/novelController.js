"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementNovelView = exports.getChaptersByNovel = exports.deleteNovel = exports.updateNovel = exports.createNovel = exports.getNovelById = exports.getNovelCover = exports.getNovels = exports.invalidateChapterCache = exports.invalidateNovelCache = void 0;
const prisma_1 = require("../utils/prisma");
const imageService_1 = require("../services/imageService");
const redis_1 = __importStar(require("../utils/redis"));
const queue_1 = require("../utils/queue");
const jwt_1 = require("../utils/jwt");
// Helper to get user info from optional Authorization header
const getUserFromHeader = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return null;
    const token = authHeader.split(' ')[1];
    try {
        const payload = (0, jwt_1.decodeAccessToken)(token);
        return {
            userId: payload?.userId || payload?.id || '',
            role: payload?.role || 'USER'
        };
    }
    catch {
        return null;
    }
};
// Helper: Build stable Redis cache key (Sorted query params)
const buildCacheKey = (query) => {
    const sorted = Object.keys(query)
        .sort()
        .reduce((acc, key) => {
        acc[key] = query[key];
        return acc;
    }, {});
    return `novels:list:${JSON.stringify(sorted)}`;
};
// Cache Invalidation
// Cache Invalidation for Novels
// Cache Invalidation for Novels (Version-based)
const invalidateNovelCache = async () => {
    if (redis_1.default) {
        // Increment version to verify old keys (O(1) invalidation)
        await redis_1.default.incr('novels:cache:version');
        console.log('[CACHE] Invalidated novel list via version increment');
    }
};
exports.invalidateNovelCache = invalidateNovelCache;
// Cache Invalidation for Chapters
const invalidateChapterCache = async (novelId) => {
    if (redis_1.default) {
        const key = `chapters:novel:${novelId}`;
        await redis_1.default.del(key);
        console.log(`[CACHE] Invalidated chapters for novel ${novelId}`);
    }
};
exports.invalidateChapterCache = invalidateChapterCache;
const getNovels = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 50);
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
        // console.log('[GET NOVELS] Starting request...');
        // console.log('[GET NOVELS] limit:', limit);
        // Redis Cache Key (Stable + Versioned)
        let cacheVersion = '1';
        if (redis_1.default) {
            cacheVersion = await redis_1.default.get('novels:cache:version') || '1';
        }
        const internalKey = buildCacheKey(req.query); // novels:list:{sorted_params}
        const cacheKey = `${internalKey}:v${cacheVersion}`;
        // Try to get from cache
        if (redis_1.default) {
            console.time('Redis Get');
            const cached = await redis_1.default.get(cacheKey);
            console.timeEnd('Redis Get');
            if (cached) {
                console.log('[CACHE HIT]', cacheKey);
                res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
                return res.json(JSON.parse(cached));
            }
        }
        console.time('DB Query');
        const novels = await prisma_1.prisma.novel.findMany({
            take: limit,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            where,
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                titleEn: true, // Fetch English title
                coverImageUrl: true, // Only need coverImageUrl, not titleEn or status for list
                views: true,
                createdAt: true,
                author: { select: { name: true } },
                _count: { select: { chapters: true } },
                chapters: {
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        title: true,
                        titleEn: true,
                        order: true
                    }
                }
            },
        });
        console.timeEnd('DB Query');
        // Fetch Redis Views
        const ids = novels.map(n => n.id);
        const redisViews = await (0, redis_1.getRedisViewCounts)('novel', ids);
        const normalized = novels.map(n => {
            let coverImage = n.coverImageUrl;
            // Optimally serve Base64 images via dedicated endpoint to reduce JSON payload
            if (coverImage && coverImage.startsWith('data:')) {
                let protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.headers['x-forwarded-host'] || req.get('host');
                // Force HTTPS in production (Vercel/Railway) to avoid mixed content
                if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
                    protocol = 'https';
                }
                coverImage = `${protocol}://${host}/api/novels/${n.id}/cover`;
            }
            return {
                id: n.id,
                title: n.title,
                titleEn: n.titleEn, // Added for localization
                coverImage: coverImage,
                views: (n.views || 0) + (redisViews[n.id] || 0), // Merge DB + Redis
                createdAt: n.createdAt,
                authorName: n.author?.name ?? 'Unknown',
                totalChapters: n._count?.chapters || 0,
                latestChapter: n.chapters?.[0] ? {
                    id: n.chapters[0].id,
                    title: n.chapters[0].title,
                    titleEn: n.chapters[0].titleEn,
                    order: n.chapters[0].order
                } : null
            };
        });
        const response = {
            novels: normalized,
            nextCursor: novels.length ? novels[novels.length - 1].id : null,
            hasMore: novels.length === limit,
        };
        // Store in cache (expire in 5 minutes)
        if (redis_1.default) {
            await redis_1.default.setex(cacheKey, 300, JSON.stringify(response));
        }
        // SWR: Cache for 1 min, but allow stale for another 30s while revalidating
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
        res.json(response);
    }
    catch (err) {
        console.error('[GET NOVELS ERROR]', err);
        if (err instanceof Error) {
            console.error('[GET NOVELS STACK]', err.stack);
        }
        res.status(500).json({
            message: 'Server error',
            error: err instanceof Error ? err.message : String(err),
            details: err instanceof Error ? err.stack : undefined
        });
    }
};
exports.getNovels = getNovels;
// Serve Cover Image directly (Decoder for Base64)
const getNovelCover = async (req, res) => {
    const id = String(req.params.id);
    try {
        const novel = await prisma_1.prisma.novel.findUnique({
            where: { id },
            select: { coverImageUrl: true }
        });
        if (!novel || !novel.coverImageUrl) {
            return res.status(404).send('Not found');
        }
        const cover = novel.coverImageUrl;
        // If it's a URL, redirect
        if (cover.startsWith('http')) {
            return res.redirect(cover);
        }
        // If Base64, decode and serve
        if (cover.startsWith('data:')) {
            const matches = cover.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(500).send('Invalid base64 string');
            }
            const type = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            res.writeHead(200, {
                'Content-Type': type,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=604800, immutable' // Cache for 7 days
            });
            res.end(buffer);
            return;
        }
        res.status(404).send('Image format not supported via API');
    }
    catch (error) {
        console.error('[GET COVER ERROR]', error);
        res.status(500).send('Server Error');
    }
};
exports.getNovelCover = getNovelCover;
const getNovelById = async (req, res) => {
    const id = String(req.params.id);
    try {
        const user = getUserFromHeader(req.headers.authorization);
        const userId = user?.userId;
        const userRole = user?.role;
        const novel = await prisma_1.prisma.novel.findFirst({
            where: {
                id,
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
                authorId: true, // Need this for ownership check
                author: { select: { name: true } },
                _count: { select: { chapters: true, likes: true, bookmarks: true } },
                // Check if user has liked/bookmarked
                likes: userId ? { where: { userId }, select: { id: true } } : false,
                bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
            }
        });
        if (!novel) {
            return res.status(404).json({ message: "Not found" });
        }
        // Access Control: If not Published, only allow Admin or Author
        if (novel.status !== 'PUBLISHED') {
            const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
            const isAuthor = userId === novel.authorId;
            if (!isAdmin && !isAuthor) {
                console.log(`[ACCESS DENIED] User ${userId} (Role: ${userRole}) tried to access draft novel ${id}`);
                return res.status(404).json({ message: "Not found" });
            }
            console.log(`[ACCESS GRANTED] Authorized user ${userId} accessing draft/private novel ${id}`);
        }
        // Merge DB views + Redis views
        const redisCount = await (0, redis_1.getRedisViewCount)('novel', id);
        const totalViews = (novel.views || 0) + redisCount;
        if (!novel.titleEn || !novel.descriptionEn) {
            (0, queue_1.addTranslationJob)('novel', id);
        }
        // Process Cover Image URL (Server-side optimization)
        let coverImage = novel.coverImageUrl;
        if (coverImage && coverImage.startsWith('data:')) {
            let protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.headers['x-forwarded-host'] || req.get('host');
            // Force HTTPS in production
            if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
                protocol = 'https';
            }
            coverImage = `${protocol}://${host}/api/novels/${novel.id}/cover`;
        }
        // Normalize Data (Backend-side)
        const normalizedNovel = {
            ...novel,
            coverImage: coverImage,
            coverImageUrl: coverImage, // Update both for consistency
            author: novel.author?.name || 'Unknown',
            authorName: novel.author?.name || 'Unknown',
            views: totalViews,
            totalChapters: novel._count?.chapters || 0,
            isLiked: userId ? novel.likes.length > 0 : false,
            isBookmarked: userId ? novel.bookmarks.length > 0 : false,
            likes: undefined, // Clear nested relations
            bookmarks: undefined
        };
        // PRIVATE: Contains user-specific data (likes/bookmarks)
        res.setHeader("Cache-Control", "private, no-store");
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
    const { title, description, novel_summary, genre, categories, coverImageUrl, cover_image, coverImage, status, title_en, titleEn, summary_en, descriptionEn } = req.body;
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
        // Process Image
        const rawCoverImage = coverImageUrl || cover_image || coverImage || '';
        const dbCoverImage = await imageService_1.ImageService.processImage(rawCoverImage);
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
        await (0, exports.invalidateNovelCache)();
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
    const { title, description, novel_summary, genre, categories, coverImageUrl, cover_image, coverImage, status, title_en, titleEn, summary_en, descriptionEn } = req.body;
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
        // Process Image if provided
        if (coverImageUrl || cover_image || coverImage) {
            const rawCoverImage = coverImageUrl || cover_image || coverImage;
            dbData.coverImageUrl = await imageService_1.ImageService.processImage(rawCoverImage);
        }
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
        await (0, exports.invalidateNovelCache)();
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
        await prisma_1.prisma.novel.update({
            where: { id },
            data: {
                status: 'DELETED',
                // @ts-ignore
                deletedAt: new Date()
            }
        });
        await (0, exports.invalidateNovelCache)();
        console.log(`[SOFT DELETE] Novel ${id} marked as deleted`);
        res.json({ message: 'Novel deleted successfully' });
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
        const id = String(req.params.id);
        const cacheKey = `chapters:novel:${id}`;
        // 1. Try Cache
        if (redis_1.default) {
            const cached = await redis_1.default.get(cacheKey);
            if (cached) {
                res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
                res.json(JSON.parse(cached));
                return;
            }
        }
        // 2. Fetch Novel Status for Access Control
        const novel = await prisma_1.prisma.novel.findUnique({
            where: { id },
            select: { status: true, authorId: true }
        });
        if (!novel || novel.deletedAt) {
            res.status(404).json({ message: "Novel not found" });
            return;
        }
        if (novel.status !== 'PUBLISHED') {
            const user = getUserFromHeader(req.headers.authorization);
            const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
            const isAuthor = user?.userId === novel.authorId;
            if (!isAdmin && !isAuthor) {
                res.status(404).json({ message: "Not found" });
                return;
            }
        }
        // 3. DB Query
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
        // 3. Fetch Redis View Counts for these chapters
        const chapterIds = chapters.map(c => c.id);
        const redisViews = await (0, redis_1.getRedisViewCounts)('chapter', chapterIds);
        const formattedChapters = chapters.map((ch) => ({
            _id: ch.id, // Legacy compatibility
            id: ch.id,
            novelId: id,
            title: ch.title,
            titleEn: ch.titleEn,
            chapterNumber: ch.order,
            order: ch.order,
            views: (ch.views || 0) + (redisViews[ch.id] || 0),
            thumbnail: ch.thumbnailUrl,
            createdAt: ch.createdAt,
            updatedAt: ch.updatedAt
        }));
        const response = {
            chapters: formattedChapters,
            success: true
        };
        // 4. Store in Cache (5 mins)
        if (redis_1.default) {
            await redis_1.default.setex(cacheKey, 300, JSON.stringify(response));
        }
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
        res.json(response);
    }
    catch (error) {
        console.error('getChaptersByNovel error:', error);
        res.status(500).json({ message: 'Error fetching chapters', error });
    }
};
exports.getChaptersByNovel = getChaptersByNovel;
// Public: Increment view count for novel (BUFFERED via Redis)
const incrementNovelView = async (req, res) => {
    const id = String(req.params.id);
    try {
        // Increment in Redis only
        await (0, redis_1.incrementViewCount)('novel', id);
        return res.status(204).end();
    }
    catch (error) {
        console.error("INCREMENT NOVEL VIEW ERROR:", error);
        res.status(204).end();
    }
};
exports.incrementNovelView = incrementNovelView;
