"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReadingProgress = exports.getReadingProgress = exports.updateReadingProgress = void 0;
const prisma_1 = require("../utils/prisma");
// Update Reading Progress
const updateReadingProgress = async (req, res) => {
    try {
        const { novelId, chapterId, lastChapter, progress } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Prioritize chapterId (UUID), fallback to lastChapter if it looks like a UUID (legacy support)
        // If lastChapter is a number (order), we can't use it directly for the relation without a lookup.
        // The frontend should now be sending UUIDs.
        let activeChapterId = chapterId || (typeof lastChapter === 'string' && lastChapter.length > 10 ? lastChapter : undefined);
        // 3. Fallback: If lastChapter is a NUMBER (e.g. 1 from startReading), find the chapter ID by order
        if (!activeChapterId && typeof lastChapter === 'number') {
            const chapterByOrder = await prisma_1.prisma.chapter.findFirst({
                where: {
                    novelId,
                    order: lastChapter
                },
                select: { id: true }
            });
            if (chapterByOrder) {
                activeChapterId = chapterByOrder.id;
            }
        }
        if (!novelId || !activeChapterId) {
            res.status(400).json({ message: 'Novel ID and Valid Chapter ID (UUID) or Chapter Order are required' });
            return;
        }
        // Upsert progress (Create or Update)
        const readingProgress = await prisma_1.prisma.readingProgress.upsert({
            where: {
                userId_novelId: {
                    userId,
                    novelId
                }
            },
            update: {
                chapterId: activeChapterId,
                progress: progress || 0,
                lastRead: new Date()
            },
            create: {
                userId,
                novelId,
                chapterId: activeChapterId,
                progress: progress || 0,
                lastRead: new Date()
            }
        });
        res.json({ success: true, data: readingProgress });
    }
    catch (error) {
        console.error('updateReadingProgress error:', error);
        res.status(500).json({ success: false, message: 'Error updating reading progress', error });
    }
};
exports.updateReadingProgress = updateReadingProgress;
// Get Reading Progress
const getReadingProgress = async (req, res) => {
    try {
        const { novelId } = req.query;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // If novelId is provided, get progress for that specific novel
        if (novelId) {
            const progress = await prisma_1.prisma.readingProgress.findUnique({
                where: {
                    userId_novelId: {
                        userId,
                        novelId: String(novelId)
                    }
                },
                include: {
                    chapter: {
                        select: {
                            id: true,
                            title: true,
                            order: true
                        }
                    }
                }
            });
            res.json({ success: true, data: progress });
            return;
        }
        // If no novelId, return ALL progress for the user
        const allProgress = await prisma_1.prisma.readingProgress.findMany({
            where: { userId },
            orderBy: { lastRead: 'desc' }, // Show most recently read first
            take: 10, // Limit to top 10
            include: {
                chapter: {
                    select: {
                        id: true,
                        order: true,
                        title: true
                    }
                },
                novel: {
                    select: {
                        id: true,
                        title: true,
                        titleEn: true,
                        deletedAt: true,
                        coverImageUrl: true,
                        author: { select: { name: true } },
                        _count: {
                            select: { chapters: true }
                        }
                    }
                }
            }
        });
        // Format for frontend ReadingProgressContext & Dashboard
        const formattedProgress = {
            ongoing: allProgress
                .filter(p => p.novel && !p.novel.deletedAt && p.chapter) // Filter out orphaned records and soft-deleted novels
                .map(p => ({
                novelId: p.novelId,
                novelTitle: p.novel.title,
                novelTitleEn: p.novel.titleEn || undefined,
                coverImage: p.novel.coverImageUrl,
                author: p.novel.author?.name || 'Unknown',
                lastChapter: p.chapter?.order || 1, // Legacy support (Order)
                lastChapterId: p.chapterId, // UUID for navigation
                lastChapterOrder: p.chapter?.order || 1, // Int for progress bar
                totalChapters: p.novel._count.chapters || 0,
                updatedAt: p.lastRead
            })),
            completed: [] // TODO: Implement completion logic if needed using status or lastChapter === totalChapters
        };
        res.json({ success: true, data: formattedProgress });
    }
    catch (error) {
        console.error('getReadingProgress error:', error);
        res.status(500).json({ success: false, message: 'Error fetching reading progress', error });
    }
};
exports.getReadingProgress = getReadingProgress;
// Delete Reading Progress
const deleteReadingProgress = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        if (!novelId) {
            res.status(400).json({ message: 'Novel ID is required' });
            return;
        }
        await prisma_1.prisma.readingProgress.delete({
            where: {
                userId_novelId: {
                    userId,
                    novelId
                }
            }
        });
        res.json({ success: true, message: 'Reading progress deleted' });
    }
    catch (error) {
        console.error('deleteReadingProgress error:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Reading progress not found' });
            return;
        }
        res.status(500).json({ success: false, message: 'Error deleting reading progress', error });
    }
};
exports.deleteReadingProgress = deleteReadingProgress;
