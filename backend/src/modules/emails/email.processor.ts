import { EmailStatus, type Email, type Sender } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../integrations/email/smtp.service';
import { indexEmailDocument } from '../../lib/emailSearch';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { addDelayedEmailJob } from '../../lib/queue';
import { RateLimiterService } from '../../services/rateLimiter.service';
import { SlackService } from '../../services/slack.service';

export type ProcessEmailResult =
  | { outcome: 'sent'; email: Email }
  | { outcome: 'failed'; email: Email; error: string }
  | { outcome: 'skipped'; reason: string; email?: Email }
  | {
      outcome: 'rescheduled';
      emailId: string;
      reason: 'global_limit_reached' | 'sender_limit_reached';
      msUntilNextHour: number;
      nextAvailableTime: Date;
    };

function formatFromAddress(sender: Sender): string {
  if (sender.displayName) {
    return `${sender.displayName} <${sender.email}>`;
  }
  return sender.email || env.SMTP_FROM;
}

/**
 * Processes one scheduled email job with database-backed atomic claim,
 * distributed rate limiting, minimum send delay spacing, BullMQ rescheduling,
 * and best-effort Slack rate limit notifications.
 */
export async function processScheduledEmail(
  emailId: string,
  options?: {
    globalLimit?: number;
    senderLimit?: number;
    minSendDelayMs?: number;
  },
): Promise<ProcessEmailResult> {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true },
  });

  if (!email) {
    logger.warn('Email job skipped — record not found in database', { emailId });
    return { outcome: 'skipped', reason: 'email_not_found' };
  }

  // Idempotency / terminal-state guards
  if (email.status === EmailStatus.SENT) {
    logger.info('Email job skipped because SENT', { emailId });
    return { outcome: 'skipped', reason: 'already_sent', email };
  }

  if (email.status === EmailStatus.CANCELLED) {
    logger.info('Email job skipped because CANCELLED', { emailId });
    return { outcome: 'skipped', reason: 'cancelled', email };
  }

  if (email.status === EmailStatus.PROCESSING) {
    logger.warn('Email job skipped because PROCESSING (concurrent execution blocked)', {
      emailId,
    });
    return { outcome: 'skipped', reason: 'already_processing', email };
  }

  // Atomic claim: transition SCHEDULED or FAILED → PROCESSING
  const claimed = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.FAILED] },
    },
    data: { status: EmailStatus.PROCESSING },
  });

  if (claimed.count === 0) {
    logger.info('Email job skipped — atomic claim failed (lost race)', { emailId });
    return { outcome: 'skipped', reason: 'claim_lost', email };
  }

  logger.info('Email claimed by worker', { emailId, previousStatus: email.status });

  // Rate Limiting Check: reserve hourly capacity across global & sender keys
  const rateLimitCheck = await RateLimiterService.reserveCapacity({
    senderId: email.senderId,
    globalLimit: options?.globalLimit ?? env.MAX_EMAILS_PER_HOUR,
    senderLimit: options?.senderLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER,
  });

  if (!rateLimitCheck.allowed) {
    const nextAvailableTime = new Date(Date.now() + rateLimitCheck.msUntilNextHour);

    // Revert status to SCHEDULED & update scheduledAt in PostgreSQL
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SCHEDULED,
        scheduledAt: nextAvailableTime,
      },
    });

    // Reschedule BullMQ delayed job for the start of the next hour window
    await addDelayedEmailJob(emailId, rateLimitCheck.msUntilNextHour);

    // Best-effort Slack rate limit notification if user is connected
    try {
      void SlackService.sendRateLimitNotification({
        userId: email.userId,
        senderId: email.senderId,
        senderEmail: email.sender?.email,
        msUntilNextHour: rateLimitCheck.msUntilNextHour,
      });
    } catch (slackErr) {
      logger.warn('Slack rate-limit notification trigger error', {
        emailId,
        message: slackErr instanceof Error ? slackErr.message : String(slackErr),
      });
    }

    logger.info('Email rate limit reached — job rescheduled for next hour window', {
      emailId,
      reason: rateLimitCheck.reason,
      msUntilNextHour: rateLimitCheck.msUntilNextHour,
      nextAvailableTime,
    });

    return {
      outcome: 'rescheduled',
      emailId,
      reason: rateLimitCheck.reason,
      msUntilNextHour: rateLimitCheck.msUntilNextHour,
      nextAvailableTime,
    };
  }

  // Enforce global MIN_SEND_DELAY_MS spacing across parallel workers
  const minDelayMs = options?.minSendDelayMs ?? env.MIN_SEND_DELAY_MS;
  const sendDelayWaitMs = await RateLimiterService.reserveSendDelaySlot(minDelayMs);

  if (sendDelayWaitMs > 0) {
    logger.info('Applying send delay before SMTP send', {
      emailId,
      sendDelayWaitMs,
      minDelayMs,
    });
    await new Promise((resolve) => setTimeout(resolve, sendDelayWaitMs));
  }

  const sender = email.sender;

  try {
    const smtpResult = await sendEmail({
      from: formatFromAddress(sender),
      to: email.recipient,
      subject: email.subject,
      body: email.body,
    });

    const sent = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        failedAt: null,
        errorMessage: null,
      },
      include: { sender: true },
    });

    try {
      await indexEmailDocument(sent, sent.sender);
    } catch (indexErr) {
      // Send already succeeded — do not fail the job because search indexing lagged.
      logger.error('Elasticsearch indexing failed after SENT', {
        emailId,
        message: indexErr instanceof Error ? indexErr.message : String(indexErr),
      });
    }

    logger.info('Email sent successfully', {
      emailId,
      messageId: smtpResult.messageId,
      previewUrl: smtpResult.previewUrl || undefined,
    });

    return { outcome: 'sent', email: sent };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error';

    const failed = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.FAILED,
        failedAt: new Date(),
        errorMessage: message,
      },
      include: { sender: true },
    });

    try {
      await indexEmailDocument(failed, failed.sender);
    } catch (indexErr) {
      logger.error('Elasticsearch indexing failed after FAILED', {
        emailId,
        message: indexErr instanceof Error ? indexErr.message : String(indexErr),
      });
    }

    logger.error('Email send failed', { emailId, error: message });
    return { outcome: 'failed', email: failed, error: message };
  }
}
