"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.verifyToken = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../utils/prisma");
const jwt_1 = require("../utils/jwt");
const register = async (req, res) => {
    const { email, password, role, username, name } = req.body;
    try {
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                role: role || 'USER',
                username,
                name
            },
        });
        const tokens = (0, jwt_1.generateTokens)(user.id, user.role);
        res.status(201).json({ user, ...tokens });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const loginIdentifier = email || username;
        // ✅ Validate input
        if (!loginIdentifier || !password) {
            return res.status(400).json({
                message: 'Email/Username and password are required',
            });
        }
        // ✅ Find user
        const user = await prisma_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email: loginIdentifier },
                    { username: loginIdentifier }
                ]
            }
        });
        if (!user) {
            return res.status(401).json({
                message: 'Invalid email/username or password',
            });
        }
        // ✅ Compare password
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid email/username or password',
            });
        }
        // ✅ Create tokens
        const tokens = (0, jwt_1.generateTokens)(user.id, user.role);
        // ✅ Send clean response (compatible with frontend authService)
        res.json({
            ...tokens, // accessToken, refreshToken
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                username: user.username
            },
        });
    }
    catch (err) {
        console.error('[LOGIN ERROR]', err);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.login = login;
const verifyToken = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        // Don't send password hash
        const { passwordHash, ...userInfo } = user;
        res.json({ user: userInfo });
    }
    catch (error) {
        res.status(500).json({ message: 'Error verifying token', error });
    }
};
exports.verifyToken = verifyToken;
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'Refresh token required' });
        return;
    }
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        // Optional: Check if user still exists/is active
        const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            res.status(401).json({ message: 'User not found' });
            return;
        }
        const tokens = (0, jwt_1.generateTokens)(user.id, user.role);
        res.json(tokens);
    }
    catch (error) {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
};
exports.refreshToken = refreshToken;
