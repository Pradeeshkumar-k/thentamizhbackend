"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const novelRoutes_1 = __importDefault(require("./routes/novelRoutes"));
const chapterRoutes_1 = __importDefault(require("./routes/chapterRoutes"));
const commentRoutes_1 = __importDefault(require("./routes/commentRoutes"));
const readingRoutes_1 = __importDefault(require("./routes/readingRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/novels', novelRoutes_1.default);
app.use('/api/chapters', chapterRoutes_1.default);
app.use('/api/comments', commentRoutes_1.default);
app.use('/api/reading', readingRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.get('/api/ping', (req, res) => {
    res.json({ pong: true, time: new Date().toISOString() });
});
app.get('/', (req, res) => {
    res.send('Novel Platform Backend is running!');
});
exports.default = app;
