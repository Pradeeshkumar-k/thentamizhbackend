"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const novelController_1 = require("../controllers/novelController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
// Alias for frontend standard: /novels/:novelId/chapters/:chapterId
const chapterController_1 = require("../controllers/chapterController");
const interactionController_1 = require("../controllers/interactionController");
const router = express_1.default.Router();
// Interaction Routes
router.post('/like', authMiddleware_1.authenticate, interactionController_1.likeNovel);
router.delete('/like', authMiddleware_1.authenticate, interactionController_1.unlikeNovel);
router.post('/bookmark', authMiddleware_1.authenticate, interactionController_1.bookmarkNovel);
router.delete('/bookmark', authMiddleware_1.authenticate, interactionController_1.removeBookmark);
router.get('/bookmarks', authMiddleware_1.authenticate, interactionController_1.getBookmarkedNovels);
router.get('/', novelController_1.getNovels);
router.get('/:id', novelController_1.getNovelById);
router.get('/:id/chapters', novelController_1.getChaptersByNovel);
// Frontend compatibility route
router.get('/:novelId/chapters/:id', chapterController_1.getChapterById);
router.post('/', authMiddleware_1.authenticate, (0, authMiddleware_1.authorizeRole)('ADMIN'), novelController_1.createNovel);
router.put('/:id', authMiddleware_1.authenticate, (0, authMiddleware_1.authorizeRole)('ADMIN'), novelController_1.updateNovel);
router.delete('/:id', authMiddleware_1.authenticate, (0, authMiddleware_1.authorizeRole)('ADMIN'), novelController_1.deleteNovel);
exports.default = router;
