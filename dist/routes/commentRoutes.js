"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const commentController_1 = require("../controllers/commentController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const rateLimit_1 = require("../middlewares/rateLimit");
const router = express_1.default.Router();
// Apply rate limiter + auth
router.post('/', authMiddleware_1.authenticate, rateLimit_1.commentLimiter, commentController_1.addComment);
router.delete('/:id', authMiddleware_1.authenticate, commentController_1.deleteComment);
exports.default = router;
