import type { NextFunction, Request, Response } from 'express';
import type { User } from '@prisma/client';
import { authService } from './auth.service';
import { AppError } from '../../lib/errors';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let token: string | undefined;

    if (req.cookies && req.cookies.reachinbox_session) {
      token = req.cookies.reachinbox_session as string;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      throw new AppError('Unauthorized — Authentication required', 401);
    }

    const user = await authService.verifySessionToken(token);
    if (!user) {
      throw new AppError('Unauthorized — Invalid or expired session', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let token: string | undefined;

    if (req.cookies && req.cookies.reachinbox_session) {
      token = req.cookies.reachinbox_session as string;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (token) {
      const user = await authService.verifySessionToken(token);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch {
    next();
  }
}
