import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => { // Return void
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return; // Ensure function execution stops
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token) as { userId: string; role: string };
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return; // Ensure function execution stops
  }
};

export const authorizeRole = (role: 'ADMIN' | 'USER' | 'SUPER_ADMIN') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => { // Return void
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    // SUPER_ADMIN has access to everything ADMIN has
    if (req.user.role === 'SUPER_ADMIN') {
        next();
        return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ message: 'Forbidden' });
      return; // Ensure function execution stops
    }
    next();
  };
};
