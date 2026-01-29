import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/authRoutes';
import novelRoutes from './routes/novelRoutes';
import chapterRoutes from './routes/chapterRoutes';
import commentRoutes from './routes/commentRoutes';
import readingRoutes from './routes/readingRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();

app.use(cors({
  origin: [
    "https://thentamizhnovel.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET","POST","PUT","DELETE"],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

import { checkHealth } from './controllers/healthController';

app.use('/api/auth', authRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', checkHealth); // New Debug Route

import prisma from './utils/prisma';

app.get('/api/debug-db', async (req, res) => {
  try {
    console.log('Testing DB Access...');
    const userCount = await prisma.user.count();
    res.json({ 
      status: 'success', 
      message: 'Database connection successful', 
      stats: { userCount },
      env: {
        db_url_configured: !!process.env.DATABASE_URL,
        node_env: process.env.NODE_ENV
      }
    });
  } catch (error: any) {
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

export default app;
