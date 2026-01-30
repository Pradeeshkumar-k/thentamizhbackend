import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const checkHealth = async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.1.0-optimized',
    environment: process.env.NODE_ENV || 'production'
  });
};
