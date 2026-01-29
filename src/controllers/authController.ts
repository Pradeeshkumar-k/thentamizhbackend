import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, username, name } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role || 'USER',
        username,
        name
      },
    });

    const tokens = generateTokens(user.id, user.role);
    res.status(201).json({ user, ...tokens });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as any).message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, username, password } = req.body;
  const loginIdentifier = email || username;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { username: loginIdentifier }
        ]
      }
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens(user.id, user.role);
    res.json({ user, ...tokens });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as any).message });
  }
};

export const verifyToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Don't send password hash
    const { passwordHash, ...userInfo } = user;
    res.json({ user: userInfo });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying token', error });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token required' });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken) as { userId: string; role: string };
    
    // Optional: Check if user still exists/is active
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    const tokens = generateTokens(user.id, user.role);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};
