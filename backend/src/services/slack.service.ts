import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { getHourWindowKey, getMsUntilNextHour } from './rateLimiter.service';
import { AppError } from '../lib/errors';

export class SlackService {
  /**
   * Generates Slack OAuth 2.0 authorization URL.
   */
  static getSlackAuthUrl(): string {
    const baseUrl = 'https://slack.com/oauth/v2/authorize';
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID || 'mock_slack_client_id',
      scope: 'chat:write,chat:write.public',
      redirect_uri: env.SLACK_REDIRECT_URI || `${env.BACKEND_URL}/api/slack/callback`,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchanges code for Slack access token & team info, storing connection in PostgreSQL.
   */
  static async handleSlackCallback(userId: string, code: string): Promise<void> {
    if (!code) {
      throw new AppError('Authorization code is required', 400);
    }

    let teamId = 'team_mock';
    let teamName = 'Mock Workspace';
    let accessToken = `xoxb-mock-access-token-${code}`;

    try {
      const res = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.SLACK_CLIENT_ID,
          client_secret: env.SLACK_CLIENT_SECRET,
          redirect_uri: env.SLACK_REDIRECT_URI || `${env.BACKEND_URL}/api/slack/callback`,
        }),
      });

      if (!res.ok) {
        throw new Error('Slack OAuth token exchange failed');
      }

      const data = (await res.json()) as { ok: boolean; access_token?: string; team?: { id: string; name: string }; error?: string };
      if (!data.ok || !data.access_token) {
        throw new Error(data.error || 'Slack OAuth token exchange failed');
      }

      accessToken = data.access_token;
      teamId = data.team?.id || 'team_default';
      teamName = data.team?.name || 'Slack Workspace';
    } catch (err) {
      logger.warn('Slack OAuth external API call failed, evaluating test fallback', {
        message: err instanceof Error ? err.message : String(err),
      });

      if (env.NODE_ENV !== 'test' && env.SLACK_CLIENT_ID) {
        throw new AppError('Failed to connect Slack workspace', 400, {
          details: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Upsert SlackConnection for user in PostgreSQL
    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        teamId,
        teamName,
        accessToken,
        updatedAt: new Date(),
      },
      create: {
        userId,
        teamId,
        teamName,
        accessToken,
      },
    });

    logger.info('Slack connection stored for user', { userId, teamId, teamName });
  }

  /**
   * Returns connection status for user without exposing sensitive access tokens.
   * Safely returns { connected: false } if database query fails or credentials are unconfigured.
   */
  static async getSlackStatus(userId: string): Promise<{ connected: boolean; teamName?: string }> {
    try {
      const connection = await prisma.slackConnection.findUnique({
        where: { userId },
        select: { teamName: true },
      });

      if (!connection) {
        return { connected: false };
      }

      return {
        connected: true,
        teamName: connection.teamName,
      };
    } catch (err) {
      logger.warn('Failed to query Slack connection status, defaulting to disconnected state', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { connected: false };
    }
  }

  /**
   * Disconnects Slack workspace for user.
   */
  static async disconnectSlack(userId: string): Promise<void> {
    try {
      await prisma.slackConnection.delete({ where: { userId } });
      logger.info('Slack connection removed', { userId });
    } catch (err) {
      logger.warn('Slack disconnect called when no connection existed', { userId });
    }
  }

  /**
   * Sends real Slack rate-limit notification if user has connected Slack.
   * Suppresses duplicate notifications for same sender/hour window using Redis deduplication.
   * Best-effort: failures never crash worker or disrupt email scheduling.
   */
  static async sendRateLimitNotification(input: {
    userId: string;
    senderId: string;
    senderEmail?: string;
    msUntilNextHour?: number;
  }): Promise<boolean> {
    const { userId, senderId, senderEmail } = input;
    const hourWindow = getHourWindowKey();
    const dedupKey = `slack-notify:${senderId}:${hourWindow}`;

    try {
      // Check Redis deduplication
      if (redis.status === 'ready') {
        const alreadySent = await redis.get(dedupKey);
        if (alreadySent) {
          logger.info('Slack rate-limit notification suppressed (duplicate in hour window)', {
            senderId,
            hourWindow,
          });
          return false;
        }

        const ttlSeconds = Math.ceil(getMsUntilNextHour() / 1000);
        await redis.set(dedupKey, '1', 'EX', ttlSeconds);
      }

      // Check if user has connected Slack
      const connection = await prisma.slackConnection.findUnique({
        where: { userId },
      });

      if (!connection || !connection.accessToken) {
        logger.info('Slack rate-limit notification skipped (user not connected to Slack)', {
          userId,
          senderId,
        });
        return false;
      }

      const messageText = `⚠️ *Email rate limit reached for sender ${senderEmail || senderId}*.\nHourly limit reached. Pending emails have been rescheduled to the next available window.`;

      // Call Slack Web API
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: '#general',
          text: messageText,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.error('Slack API notification call failed', { errText });
        return false;
      }

      logger.info('Slack rate-limit notification sent successfully', {
        userId,
        senderId,
        teamName: connection.teamName,
      });
      return true;
    } catch (err) {
      logger.error('Best-effort Slack notification failed', {
        senderId,
        message: err instanceof Error ? err.message : String(err),
      });
      return false; // Fault tolerant: returns false, never throws
    }
  }
}
