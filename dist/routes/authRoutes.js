"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
router.post('/register', authController_1.register);
router.post('/signup', authController_1.register); // Alias for frontend
router.post('/login', authController_1.login);
router.post('/refresh', authController_1.refreshToken);
router.get('/verify', authMiddleware_1.authenticate, authController_1.verifyToken);
exports.default = router;
