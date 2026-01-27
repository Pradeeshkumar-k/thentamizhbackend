import express from 'express';
import { register, login, verifyToken, refreshToken } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/register', register);
router.post('/signup', register); // Alias for frontend
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/verify', authenticate, verifyToken);

export default router;
