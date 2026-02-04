import express from 'express';
import { 
  getNovels, 
  getNovelById, 
  getNovelCover,
  getChaptersByNovel,
  createNovel, 
  updateNovel, 
  deleteNovel,
  incrementNovelView
} from '../controllers/novelController';

import { authenticate, authorizeRole } from '../middlewares/authMiddleware';

// Alias for frontend standard: /novels/:novelId/chapters/:chapterId
import { getChapterById } from '../controllers/chapterController';
import { likeNovel, unlikeNovel, bookmarkNovel, removeBookmark, getBookmarkedNovels } from '../controllers/interactionController';

const router = express.Router();

// Interaction Routes
router.post('/like', authenticate, likeNovel);
router.delete('/like', authenticate, unlikeNovel);
router.post('/bookmark', authenticate, bookmarkNovel);
router.delete('/bookmark', authenticate, removeBookmark);
router.get('/bookmarks', authenticate, getBookmarkedNovels);

router.get('/', getNovels);
router.get('/:id', getNovelById);
router.get('/:id/cover', getNovelCover);
router.post('/:id/view', incrementNovelView);
router.get('/:id/chapters', getChaptersByNovel);

// Frontend compatibility route
router.get('/:novelId/chapters/:id', getChapterById);


router.post('/', authenticate, authorizeRole('ADMIN'), createNovel);
router.put('/:id', authenticate, authorizeRole('ADMIN'), updateNovel);
router.delete('/:id', authenticate, authorizeRole('ADMIN'), deleteNovel);

export default router;
