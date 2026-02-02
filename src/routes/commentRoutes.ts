import express from 'express';
import { addComment, deleteComment } from '../controllers/commentController';
import { authenticate } from '../middlewares/authMiddleware';
import { commentLimiter } from '../middlewares/rateLimit';

const router = express.Router();

// Apply rate limiter + auth
router.post('/', authenticate, commentLimiter, addComment);
router.delete('/:id', authenticate, deleteComment);

export default router;
