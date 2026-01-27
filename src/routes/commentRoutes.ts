import express from 'express';
import { addComment, deleteComment } from '../controllers/commentController';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/', authenticate, addComment);
router.delete('/:id', authenticate, deleteComment);

export default router;
