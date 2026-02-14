import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';

dotenv.config();

import authRoutes from './routes/authRoutes';
import novelRoutes from './routes/novelRoutes';
import chapterRoutes from './routes/chapterRoutes';
import commentRoutes from './routes/commentRoutes';
import readingRoutes from './routes/readingRoutes';
import adminRoutes from './routes/adminRoutes';
import cronRoutes from './routes/cronRoutes';

const app = express();

app.set('trust proxy', 1);

app.use(compression());

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = ['https://thentamizhnovel.vercel.app', 'https://thentamizhamuthunovels.com', 'http://localhost:5173', 'http://localhost:3000'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow local network IPs (e.g., 192.168.x.x, 10.x.x.x, 172.x.x.x) for mobile testing
    const localIpRegex = /^(http:\/\/192\.168\.\d{1,3}\.\d{1,3}|http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}|http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;
    if (localIpRegex.test(origin)) return callback(null, true);

    // Allow Vercel preview deployments
    if (origin.endsWith('.vercel.app')) return callback(null, true);

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7',
	legacyHeaders: false,
});

// Apply the rate limiting middleware to all requests.
app.use(limiter);

app.use(express.urlencoded({ extended: true, limit: '50mb' }));

import { checkHealth } from './controllers/healthController';

app.use('/api/auth', authRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cron', cronRoutes);

app.get('/api/health', checkHealth); 

app.get('/', (req, res) => {
  res.send('Novel Platform Backend is running!');
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
