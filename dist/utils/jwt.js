"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'access_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret';
const generateTokens = (userId, role) => {
    const accessToken = jsonwebtoken_1.default.sign({ userId, role }, ACCESS_TOKEN_SECRET, {
        expiresIn: '15m',
    });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, role }, REFRESH_TOKEN_SECRET, {
        expiresIn: '7d',
    });
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, ACCESS_TOKEN_SECRET);
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, REFRESH_TOKEN_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
