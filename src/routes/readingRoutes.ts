import express from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { updateReadingProgress, getReadingProgress, deleteReadingProgress } from '../controllers/readingProgressController';

const router = express.Router();

router.post('/progress', authenticate, updateReadingProgress);
router.get('/progress', authenticate, getReadingProgress);
router.delete('/progress/:novelId', authenticate, deleteReadingProgress);

export default router;
