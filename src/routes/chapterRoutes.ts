import express from 'express';
import { 
  getChapterById, 
  createChapter, 
  updateChapter, 
  deleteChapter,
  likeChapter,
  unlikeChapter,
  incrementChapterView
} from '../controllers/chapterController';
import { getCommentsByChapter } from '../controllers/commentController';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/:id', getChapterById);
router.get('/:id/comments', getCommentsByChapter);

router.post('/', authenticate, authorizeRole('ADMIN'), createChapter);
router.put('/:id', authenticate, authorizeRole('ADMIN'), updateChapter);
router.delete('/:id', authenticate, authorizeRole('ADMIN'), deleteChapter);

router.post('/:id/like', authenticate, likeChapter);
router.delete('/:id/like', authenticate, unlikeChapter);

// View increment (Internal/Frontend call)
router.post('/:id/view', incrementChapterView);

export default router;
