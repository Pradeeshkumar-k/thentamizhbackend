import express from 'express';
import { 
  getChapterById, 
  createChapter, 
  updateChapter, 
  deleteChapter,
  likeChapter,
  unlikeChapter
} from '../controllers/chapterController';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/:id', getChapterById);

router.post('/', authenticate, authorizeRole('ADMIN'), createChapter);
router.put('/:id', authenticate, authorizeRole('ADMIN'), updateChapter);
router.delete('/:id', authenticate, authorizeRole('ADMIN'), deleteChapter);

router.post('/:id/like', authenticate, likeChapter);
router.delete('/:id/like', authenticate, unlikeChapter);

export default router;
