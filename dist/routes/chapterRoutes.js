"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chapterController_1 = require("../controllers/chapterController");
const commentController_1 = require("../controllers/commentController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// View increment (Internal/Frontend call)
router.post('/:id/view', chapterController_1.incrementChapterView);
router.get('/:id', chapterController_1.getChapterById);
router.get('/:id/comments', commentController_1.getCommentsByChapter);
router.post('/', authMiddleware_1.authenticate, (0, authMiddleware_1.authorizeRole)('ADMIN'), chapterController_1.createChapter);
exports.default = router;
