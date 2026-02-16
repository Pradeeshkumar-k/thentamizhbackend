"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const adminController_1 = require("../controllers/adminController");
const router = express_1.default.Router();
// Translation Utility (diagnostic move)
// Translation Utility (diagnostic move)
// router.post('/translate', translateContent); // MOVED: Now protected below
// All admin routes require authentication and ADMIN role
router.use(authMiddleware_1.authenticate);
router.use((0, authMiddleware_1.authorizeRole)('ADMIN'));
// Dashboard
router.get('/dashboard/stats', adminController_1.getDashboardStats);
router.delete('/dashboard/activity/:id', adminController_1.deleteActivityLog);
// Novel Management
router.get('/novels', adminController_1.getAllNovelsAdmin);
router.get('/novels/:id', adminController_1.getNovelByIdAdmin);
router.post('/novels', adminController_1.createNovel);
router.put('/novels/:id', adminController_1.updateNovel);
router.delete('/novels/:id', adminController_1.deleteNovel);
// Chapter Management
router.get('/novels/:novelId/chapters', adminController_1.getChaptersByNovel);
router.get('/chapters/:id', adminController_1.getChapterById);
router.post('/novels/:novelId/chapters', adminController_1.createChapter);
router.put('/chapters/:id', adminController_1.updateChapter);
router.delete('/chapters/:id', adminController_1.deleteChapter);
// Notifications
router.get('/notifications', adminController_1.getAllNotifications);
router.patch('/notifications/:id/read', adminController_1.markNotificationAsRead);
router.patch('/notifications/read-all', adminController_1.markAllNotificationsAsRead);
// Translation Utility
router.post('/translate', adminController_1.translateContent);
// DEBUG ROUTES (Removed for Production Security)
exports.default = router;
