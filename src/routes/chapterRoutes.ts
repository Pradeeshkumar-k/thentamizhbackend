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

// View increment (Internal/Frontend call)
router.post('/:id/view', incrementChapterView);

router.get('/:id', getChapterById);
router.get('/:id/comments', getCommentsByChapter);

router.post('/:id/like', authenticate, likeChapter);
router.delete('/:id/like', authenticate, unlikeChapter);

router.post('/', authenticate, authorizeRole('ADMIN'), createChapter);

export default router;
