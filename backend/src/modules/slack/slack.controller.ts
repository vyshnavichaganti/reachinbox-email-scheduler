import type { NextFunction, Request, Response } from 'express';
import { SlackService } from '../../services/slack.service';
import { env } from '../../config/env';

export class SlackController {
  /**
   * Redirects user to Slack OAuth authorization page.
   */
  connect(_req: Request, res: Response, next: NextFunction): void {
    try {
      const url = SlackService.getSlackAuthUrl();
      res.redirect(url);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles Slack OAuth callback, stores connection, and redirects to frontend dashboard.
   */
  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const code = req.query.code as string;

      if (!userId) {
        res.redirect(`${env.FRONTEND_URL}/login?error=unauthenticated`);
        return;
      }

      await SlackService.handleSlackCallback(userId, code);

      if (req.headers.accept?.includes('application/json')) {
        const status = await SlackService.getSlackStatus(userId);
        res.status(200).json({
          success: true,
          data: status,
        });
        return;
      }

      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Returns current Slack connection status for authenticated user without exposing access token.
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const status = await SlackService.getSlackStatus(userId);
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Disconnects Slack workspace for authenticated user.
   */
  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await SlackService.disconnectSlack(userId);
      res.status(200).json({
        success: true,
        message: 'Slack disconnected successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const slackController = new SlackController();
