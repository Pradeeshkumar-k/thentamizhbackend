"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.addComment = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// User: Add comment
const addComment = async (req, res) => {
    const { chapterId, text } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        const comment = await prisma_1.default.comment.create({
            data: {
                text,
                chapterId,
                userId,
            },
            include: {
                user: { select: { email: true } }
            }
        });
        res.status(201).json(comment);
    }
    catch (error) {
        res.status(500).json({ message: 'Error adding comment', error });
    }
};
exports.addComment = addComment;
// Admin/Owner: Delete comment
const deleteComment = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        const comment = await prisma_1.default.comment.findUnique({ where: { id } });
        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }
        // Allow deletion if Admin OR if user owns the comment
        if (role !== 'ADMIN' && comment.userId !== userId) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        await prisma_1.default.comment.delete({ where: { id } });
        res.json({ message: 'Comment deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting comment', error });
    }
};
exports.deleteComment = deleteComment;
