import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const checkHealth = async (req: Request, res: Response) => {
  const healthCheck: any = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    deploymentId: 'FIX_ATTEMPT_02_CHECK_DB', // Unique ID to verify deployment
    message: 'OK',
    dbDetails: null,
    dbError: null
  };

  try {
    // Attempt a lightweight DB query
    const start = Date.now();
    const userCount = await prisma.user.count(); 
    const latency = Date.now() - start;

    healthCheck.dbDetails = {
      status: 'connected',
      userCount,
      latency: `${latency}ms`
    };
  } catch (error: any) {
    console.error('Health Check DB Failure:', error);
    healthCheck.message = 'Database Connection Failed';
    healthCheck.dbError = {
      message: error.message,
      code: error.code,
      meta: error.meta
    };
    healthCheck.dbDetails = { status: 'disconnected' };
    res.status(503).json(healthCheck); // Service Unavailable
    return;
  }

  res.status(200).json(healthCheck);
};
