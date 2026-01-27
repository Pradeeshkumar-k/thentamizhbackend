import express from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { updateReadingProgress, getReadingProgress } from '../controllers/readingProgressController';

const router = express.Router();

router.post('/progress', authenticate, updateReadingProgress);
router.get('/progress', authenticate, getReadingProgress);

export default router;
