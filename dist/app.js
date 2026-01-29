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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = [
            "https://thentamizhnovel.vercel.app",
            "http://localhost:5173",
            "http://localhost:3000"
        ];
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        // Allow any Vercel preview deployment
        if (origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
const healthController_1 = require("./controllers/healthController");
app.use('/api/auth', authRoutes_1.default);
app.use('/api/novels', novelRoutes_1.default);
app.use('/api/chapters', chapterRoutes_1.default);
app.use('/api/comments', commentRoutes_1.default);
app.use('/api/reading', readingRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.get('/api/health', healthController_1.checkHealth); // New Debug Route
const prisma_1 = __importDefault(require("./utils/prisma"));
app.get('/api/debug-db', async (req, res) => {
    try {
        console.log('Testing DB Access...');
        const userCount = await prisma_1.default.user.count();
        res.json({
            status: 'success',
            message: 'Database connection successful',
            stats: { userCount },
            env: {
                db_url_configured: !!process.env.DATABASE_URL,
                node_env: process.env.NODE_ENV
            }
        });
    }
    catch (error) {
        console.error('DB Debug Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error_name: error.name,
            error_message: error.message,
            error_code: error.code,
            meta: error.meta,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
app.get('/api/ping', (req, res) => {
    res.json({ pong: true, time: new Date().toISOString(), version: 'v2-debug' });
});
app.get('/', (req, res) => {
    res.send('Novel Platform Backend is running!');
});
exports.default = app;
