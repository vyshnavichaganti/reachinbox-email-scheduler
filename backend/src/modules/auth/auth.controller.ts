import type { NextFunction, Request, Response } from 'express';
import { authService } from './auth.service';
import { env } from '../../config/env';

export class AuthController {
  /**
   * Redirects user to Google OAuth authorization page.
   */
  googleAuth(_req: Request, res: Response, next: NextFunction): void {
    try {
      const url = authService.getGoogleAuthUrl();
      res.redirect(url);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles Google OAuth callback, sets HTTP-only session cookie, and redirects to frontend.
   */
  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string;
      const { user, token } = await authService.handleGoogleCallback(code);

      res.cookie('reachinbox_session', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      if (req.headers.accept?.includes('application/json')) {
        res.status(200).json({
          success: true,
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          },
          token,
        });
        return;
      }

      res.redirect(`${env.FRONTEND_URL}/?login=success`);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Returns current authenticated user profile.
   */
  me(req: Request, res: Response): void {
    const user = req.user!;
    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  }

  /**
   * Clears HTTP-only session cookie to log out user.
   */
  logout(_req: Request, res: Response): void {
    res.clearCookie('reachinbox_session', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

export const authController = new AuthController();
