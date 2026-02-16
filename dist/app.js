"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const compression_1 = __importDefault(require("compression"));
dotenv_1.default.config();
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const novelRoutes_1 = __importDefault(require("./routes/novelRoutes"));
const chapterRoutes_1 = __importDefault(require("./routes/chapterRoutes"));
const commentRoutes_1 = __importDefault(require("./routes/commentRoutes"));
const readingRoutes_1 = __importDefault(require("./routes/readingRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const cronRoutes_1 = __importDefault(require("./routes/cronRoutes"));
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const envOrigins = process.env.CORS_ALLOWED_ORIGINS
            ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
            : [];
        const allowedOrigins = [
            'https://thentamizhnovel.vercel.app',
            'https://thentamizhamuthunovels.com',
            'https://www.thentamizhamuthunovels.com',
            'https://thentamilzhamuthunovels.com',
            'https://www.thentamilzhamuthunovels.com',
            'http://localhost:5173',
            'http://localhost:3000',
            ...envOrigins
        ];
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        // Allow local network IPs (e.g., 192.168.x.x, 10.x.x.x, 172.x.x.x) for mobile testing
        const localIpRegex = /^(http:\/\/192\.168\.\d{1,3}\.\d{1,3}|http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}|http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;
        if (localIpRegex.test(origin))
            return callback(null, true);
        // Allow Vercel preview deployments
        if (origin.endsWith('.vercel.app'))
            return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
// Apply the rate limiting middleware to all requests.
app.use(limiter);
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
const healthController_1 = require("./controllers/healthController");
app.use('/api/auth', authRoutes_1.default);
app.use('/api/novels', novelRoutes_1.default);
app.use('/api/chapters', chapterRoutes_1.default);
app.use('/api/comments', commentRoutes_1.default);
app.use('/api/reading', readingRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/cron', cronRoutes_1.default);
app.get('/api/health', healthController_1.checkHealth);
app.get('/', (req, res) => {
    res.send('Novel Platform Backend is running!');
});
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Global Error]', err);
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
exports.default = app;
