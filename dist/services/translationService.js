"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationService = exports.translateContent = void 0;
const openai_1 = require("openai");
const google_translate_api_x_1 = require("google-translate-api-x");
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = require("../utils/prisma");
const novelController_1 = require("../controllers/novelController");
const log = (msg) => {
    console.log(`[Translation] ${msg}`);
};
dotenv_1.default.config();
const openai = process.env.OPENAI_API_KEY
    ? new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
const withTimeout = (p, ms = 15000) => Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject('Timeout'), ms))
]);
const chunkText = (text, size = 3000) => {
    const paragraphs = text.split('\n\n');
    const chunks = [];
    let current = '';
    for (const p of paragraphs) {
        if ((current + p).length > size) {
            chunks.push(current.trim());
            current = p + '\n\n';
        }
        else {
            current += p + '\n\n';
        }
    }
    if (current.trim())
        chunks.push(current.trim());
    return chunks;
};
/**
 * High-accuracy translation service
 * Prioritizes GPT-4 for literary context, falls back to Google if no key
 */
const translateContent = async (text, to = 'en') => {
    if (!text || text.trim() === '')
        return '';
    // 1. Try OpenAI if key is available
    if (openai) {
        try {
            log('Using OpenAI (gpt-4o-mini) for translation...');
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional literary translator. Translate the following Tamil novel content into natural, engaging, and accurate English prose. Maintain the emotional tone and stylistic nuances of the original text."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.3,
            });
            const translated = response.choices[0]?.message?.content;
            if (translated) {
                log('OpenAI Translation Success');
                return translated.trim();
            }
        }
        catch (openaiError) {
            log(`OpenAI Error: ${openaiError?.message || openaiError}. Code: ${openaiError?.code || 'N/A'}`);
            // Fall through to Google fallback
        }
    }
    // 2. Fallback to Google Translate (Free/Standard)
    try {
        log(`Falling back to Google Translate for text: ${text.substring(0, 30)}...`);
        const res = await (0, google_translate_api_x_1.translate)(text, {
            to,
            forceBatch: false,
            rejectOnPartialFail: false
        });
        log('Google Translation Success');
        return res.text;
    }
    catch (googleError) {
        const errorMsg = googleError?.message || googleError;
        log(`Google Translation Error: ${errorMsg}`);
        throw new Error(`Translation failed. OpenAI key: ${!!openai}. Google Error: ${errorMsg}`);
    }
};
exports.translateContent = translateContent;
exports.TranslationService = {
    translateTextOrNull: async (text) => {
        if (!text)
            return null;
        try {
            // Handle title objects if they exist
            const sourceText = typeof text === 'string' ? text : (text.tamil || text.english || '');
            if (!sourceText)
                return null;
            return await (0, exports.translateContent)(sourceText);
        }
        catch (e) {
            log(`translateTextOrNull Error: ${e}`);
            return null;
        }
    },
    translateAndSaveNovel: async (novelId) => {
        try {
            const novel = await prisma_1.prisma.novel.findUnique({ where: { id: novelId } });
            if (!novel)
                return;
            // Simple check (race condition possible but better than 500 crash)
            if (novel.titleEn && novel.descriptionEn)
                return;
            let updates = {};
            let needsUpdate = false;
            // Helper for Timeout
            const promiseWithTimeout = (promise, ms, fallback) => {
                return Promise.race([
                    promise,
                    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
                ]);
            };
            if (!novel.titleEn && novel.title) {
                try {
                    const translatedTitle = await promiseWithTimeout(exports.TranslationService.translateTextOrNull(novel.title), 15000, null);
                    if (translatedTitle) {
                        updates.titleEn = translatedTitle;
                        needsUpdate = true;
                    }
                }
                catch (e) {
                    log(`[Background] Title translation failed for ${novelId}: ${e}`);
                }
            }
            if (!novel.descriptionEn && novel.description) {
                try {
                    const translatedDesc = await promiseWithTimeout(exports.TranslationService.translateTextOrNull(novel.description), 15000, null);
                    if (translatedDesc) {
                        updates.descriptionEn = translatedDesc;
                        needsUpdate = true;
                    }
                }
                catch (e) {
                    log(`[Background] Description translation failed for ${novelId}: ${e}`);
                }
            }
            if (needsUpdate) {
                await prisma_1.prisma.novel.update({
                    where: { id: novelId },
                    data: updates
                });
                log(`[Background] Auto-translated novel ${novelId} DONE and saved.`);
                try {
                    (0, novelController_1.invalidateNovelCache)();
                }
                catch (e) { /* ignore circular dep warning */ }
            }
        }
        catch (err) {
            log(`translateAndSaveNovel Error: ${err}`);
        }
    },
    translateAndSaveChapter: async (chapterId) => {
        try {
            const start = Date.now();
            const chapter = await prisma_1.prisma.chapter.findUnique({ where: { id: chapterId } });
            // @ts-ignore
            if (!chapter || chapter.contentEn || chapter.isTranslating) {
                return chapter?.contentEn ?? null;
            }
            // Lock
            await prisma_1.prisma.chapter.update({
                where: { id: chapterId },
                // @ts-ignore
                data: { isTranslating: true }
            });
            try {
                const chunks = chunkText(chapter.content, 3000);
                const translatedChunks = [];
                for (const chunk of chunks) {
                    // Add per-chunk timeout
                    const translated = await withTimeout((0, exports.translateContent)(chunk));
                    translatedChunks.push(translated);
                }
                const fullTranslation = translatedChunks.join('\n\n');
                await prisma_1.prisma.chapter.update({
                    where: { id: chapterId },
                    data: { contentEn: fullTranslation }
                });
                log(`[Translation] Completed in ${Date.now() - start}ms`);
                try {
                    (0, novelController_1.invalidateNovelCache)();
                }
                catch { }
                return fullTranslation;
            }
            finally {
                // Unlock
                await prisma_1.prisma.chapter.update({
                    where: { id: chapterId },
                    // @ts-ignore
                    data: { isTranslating: false }
                });
            }
        }
        catch (err) {
            log(`translateAndSaveChapter Error: ${err}`);
            return null;
        }
    }
};
