import express from 'express';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';
import {
  getDashboardStats,
  getAllNovelsAdmin,
  getNovelByIdAdmin,
  createNovel,
  updateNovel,
  deleteNovel,
  getChaptersByNovel,
  getChapterById,
  createChapter,
  updateChapter,
  deleteChapter,
  getAllNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  translateContent,
  deleteActivityLog
} from '../controllers/adminController';

const router = express.Router();

// Translation Utility (diagnostic move)
// Translation Utility (diagnostic move)
// router.post('/translate', translateContent); // MOVED: Now protected below

// All admin routes require authentication and ADMIN role
router.use(authenticate);
router.use(authorizeRole('ADMIN'));

// Dashboard
router.get('/dashboard/stats', getDashboardStats);
router.delete('/dashboard/activity/:id', deleteActivityLog);

// Novel Management
router.get('/novels', getAllNovelsAdmin);
router.get('/novels/:id', getNovelByIdAdmin);
router.post('/novels', createNovel);
router.put('/novels/:id', updateNovel);
router.delete('/novels/:id', deleteNovel);

// Chapter Management
router.get('/novels/:novelId/chapters', getChaptersByNovel);
router.get('/chapters/:id', getChapterById);
router.post('/novels/:novelId/chapters', createChapter);
router.put('/chapters/:id', updateChapter);
router.delete('/chapters/:id', deleteChapter);

// Notifications
router.get('/notifications', getAllNotifications);
router.patch('/notifications/:id/read', markNotificationAsRead);
router.patch('/notifications/read-all', markAllNotificationsAsRead);

// Translation Utility
router.post('/translate', translateContent);

// DEBUG ROUTES (Removed for Production Security)

export default router;
