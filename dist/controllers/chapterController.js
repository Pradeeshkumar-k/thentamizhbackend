"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlikeChapter = exports.likeChapter = exports.deleteChapter = exports.updateChapter = exports.createChapter = exports.getChapterById = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const translationService_1 = require("../services/translationService");
// Public: Get chapter content
const getChapterById = async (req, res) => {
    const { id } = req.params;
    const { lang } = req.query; // Check for language query param
    // console.log(`[getChapterById] ID: ${id}, Lang: ${lang}`);
    // Cache Key: id + lang
    const cacheKey = `chapter_${id}_${lang || 'default'}`;
    // Simple In-Memory Cache for Chapters
    // (Ideally moved to a shared service, but defined here for speed)
    if (!global.chapterCache) {
        global.chapterCache = new Map();
    }
    const chapterCache = global.chapterCache;
    const CHAPTER_CACHE_TTL = 60 * 60 * 1000; // 1 Hour
    try {
        // 1. Check Cache
        const cached = chapterCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CHAPTER_CACHE_TTL)) {
            // console.log(`[getChapterById] Serving ${id} from Cache ⚡`);
            // Async View Increment
            prisma_1.default.chapter.update({
                where: { id },
                data: { views: { increment: 1 } }
            }).catch((e) => console.error("Async View Inc Failed", e));
            res.json(cached.data);
            return;
        }
        let chapter = await prisma_1.default.chapter.findUnique({
            where: { id },
            include: {
                novel: { select: { title: true } },
                comments: {
                    include: {
                        user: { select: { email: true, name: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                _count: {
                    select: { likes: true, comments: true }
                }
            }
        });
        if (!chapter) {
            res.status(404).json({ message: 'Chapter not found' });
            return;
        }
        // Lazy Translation Logic
        if (lang === 'english') {
            // console.log(`[getChapterById] English requested. ContentEn present: ${!!(chapter as any).contentEn}`);
            let needsUpdate = false;
            const updates = {};
            const translationTasks = [];
            if (!chapter.titleEn && chapter.title) {
                translationTasks.push(translationService_1.TranslationService.translateTextOrNull(chapter.title)
                    .then((res) => ({ type: 'title', value: res }))
                    .catch((e) => { console.error("Chapter Title translation failed", e); return { type: 'title', value: null }; }));
            }
            if (!chapter.contentEn && chapter.content) {
                const start = Date.now();
                // console.log('[getChapterById] Hybrid Translation Mode: Fetching preview...');
                // 1. Immediate Priority: Translate visible first chunk (Title + First ~2000 chars)
                const PREVIEW_LENGTH = 2000;
                const previewText = chapter.content.substring(0, PREVIEW_LENGTH);
                // Start both the preview translation AND the full background translation
                const previewPromise = translationService_1.TranslationService.translateTextOrNull(previewText)
                    .catch((e) => { console.error("Preview translation failed", e); return null; });
                // 2. Background Process: Translate EVERYTHING and save to DB
                // We do NOT await this. It runs detached.
                const fullTranslationPromise = (async () => {
                    try {
                        // Determine if we need to translate the REST or the WHOLE thing.
                        // The service handles caching/splitting, so let's just ask for the whole thing.
                        // But to save resources, we could use the preview result if we wanted. 
                        // For simplicity and robustness, let's just trigger the full parallel translation.
                        console.log('[getChapterById-Background] Starting full translation...');
                        const fullText = await translationService_1.TranslationService.translateTextOrNull(chapter.content);
                        if (fullText) {
                            await prisma_1.default.chapter.update({
                                where: { id },
                                data: { contentEn: fullText, titleEn: chapter.titleEn } // Ensure title is saved if it was generated
                            });
                            console.log(`[getChapterById-Background] Full translation saved. Length: ${fullText.length}`);
                        }
                    }
                    catch (bgError) {
                        console.error("[getChapterById-Background] Task failed", bgError);
                    }
                })();
                // 3. Handle Title (Fast enough to wait for)
                if (!chapter.titleEn && chapter.title) {
                    try {
                        const tTitle = await translationService_1.TranslationService.translateTextOrNull(chapter.title);
                        if (tTitle) {
                            chapter.titleEn = tTitle;
                            // We also save title updates immediately in the background loop or here? 
                            // The background loop above updates it too.
                        }
                    }
                    catch (e) { }
                }
                // 4. Return Preview Response
                const previewResult = await previewPromise;
                const isPartial = chapter.content.length > PREVIEW_LENGTH;
                let finalContentEn = previewResult;
                if (isPartial && previewResult) {
                    finalContentEn += `\n\n\n--- ⚡ Translating the rest of the chapter... (${Math.round(chapter.content.length / 1000)}k chars) ---\n--- The full content will appear automatically in a few seconds. ---`;
                }
                chapter.contentEn = finalContentEn;
                console.log(`[getChapterById] Returning preview in ${(Date.now() - start)}ms`);
            }
            else {
                // If translation exists, we just return it.
                // BUT: Check if it was a partial placeholder? 
                // (Implementation detail: if we saved the "Translating..." text to DB, we'd need to check. 
                // But our background job overwrites it with clean text. 
                // If the background job fails, the user might see the placeholder forever? 
                // Current logic: We do NOT save the partial text to DB in the main thread. 
                // Only the background job saves to DB. 
                // So next fetch will either find nothing (if bg failed) and retry, or find full text.
                // Perfect.)
            }
        }
        // Increment view count asynchronously
        prisma_1.default.chapter.update({
            where: { id },
            data: { views: { increment: 1 } }
        }).catch((err) => console.error('Error incrementing chapter views:', err));
        // Map to frontend expected format
        const formattedChapter = {
            ...chapter,
            _id: chapter.id,
            id: chapter.id,
            title: chapter.title,
            titleEn: chapter.titleEn, // Include EN
            content: chapter.content,
            contentEn: chapter.contentEn, // Include EN
            chapterNumber: chapter.order
        };
        // Update Cache
        chapterCache.set(cacheKey, { data: formattedChapter, timestamp: Date.now() });
        res.json(formattedChapter);
    }
    catch (error) {
        console.error('getChapterById error:', error);
        res.status(500).json({ message: 'Error fetching chapter', error: error.message });
    }
};
exports.getChapterById = getChapterById;
// Admin: Create chapter
const createChapter = async (req, res) => {
    const { novelId, title, content, order, thumbnailUrl } = req.body;
    try {
        const chapter = await prisma_1.default.chapter.create({
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
        const existing = await prisma_1.default.chapter.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Chapter not found' });
            return;
        }
        const chapter = await prisma_1.default.chapter.update({
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
        const existing = await prisma_1.default.chapter.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ message: 'Chapter not found' });
            return;
        }
        await prisma_1.default.chapter.delete({ where: { id } });
        res.json({ message: 'Chapter deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting chapter', error: error.message });
    }
};
exports.deleteChapter = deleteChapter;
// User: Like chapter
const likeChapter = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        await prisma_1.default.like.create({
            data: {
                chapterId: id,
                userId,
            },
        });
        res.status(201).json({ message: 'Chapter liked' });
    }
    catch (error) {
        res.status(400).json({ message: 'Error liking chapter (already liked?)', error: error.message });
    }
};
exports.likeChapter = likeChapter;
// User: Unlike chapter
const unlikeChapter = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        await prisma_1.default.like.delete({
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
