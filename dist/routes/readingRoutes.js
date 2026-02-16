"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const readingProgressController_1 = require("../controllers/readingProgressController");
const router = express_1.default.Router();
router.post('/progress', authMiddleware_1.authenticate, readingProgressController_1.updateReadingProgress);
router.get('/progress', authMiddleware_1.authenticate, readingProgressController_1.getReadingProgress);
router.delete('/progress/:novelId', authMiddleware_1.authenticate, readingProgressController_1.deleteReadingProgress);
exports.default = router;
