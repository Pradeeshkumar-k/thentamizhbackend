"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chapterController_1 = require("../controllers/chapterController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
router.get('/:id', chapterController_1.getChapterById);
router.post('/', authMiddleware_1.authenticate, (0, authMiddleware_1.authorizeRole)('ADMIN'), chapterController_1.createChapter);
router.put('/:id', authMiddleware_1.authenticate, (0, authMiddleware_1.authorizeRole)('ADMIN'), chapterController_1.updateChapter);
router.delete('/:id', authMiddleware_1.authenticate, (0, authMiddleware_1.authorizeRole)('ADMIN'), chapterController_1.deleteChapter);
router.post('/:id/like', authMiddleware_1.authenticate, chapterController_1.likeChapter);
router.delete('/:id/like', authMiddleware_1.authenticate, chapterController_1.unlikeChapter);
exports.default = router;
