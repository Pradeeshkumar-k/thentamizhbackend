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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/ping', (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('Novel Platform Backend is running!');
});

export default app;
