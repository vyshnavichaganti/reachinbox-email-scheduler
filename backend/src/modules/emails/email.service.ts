import { EmailStatus, Prisma, type Email } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import {
  addDelayedEmailJob,
  removeEmailJob,
  type EmailJobResult,
} from '../../lib/queue';
import { ElasticsearchService, type SearchEmailsResult } from '../../services/elasticsearch.service';
import type {
  PaginatedEmails,
  PaginationQuery,
  ScheduleEmailInput,
} from './email.types';
import type { SearchEmailsDto } from './email.validation';

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export class EmailService {
  async scheduleEmail(input: ScheduleEmailInput): Promise<Email> {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const sender = await prisma.sender.findUnique({ where: { id: input.senderId } });
    if (!sender) {
      throw new AppError('Sender not found', 404);
    }

    if (sender.userId !== input.userId) {
      throw new AppError('Sender does not belong to the given user', 400);
    }

    const existing = await prisma.email.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      throw new AppError('An email with this idempotencyKey already exists', 409, {
        emailId: existing.id,
        status: existing.status,
      });
    }

    let email: Email;
    try {
      email = await prisma.email.create({
        data: {
          userId: input.userId,
          senderId: input.senderId,
          recipient: input.recipient,
          subject: input.subject,
          body: input.body,
          scheduledAt: input.scheduledAt,
          idempotencyKey: input.idempotencyKey,
          status: EmailStatus.SCHEDULED,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError('An email with this idempotencyKey already exists', 409);
      }
      throw err;
    }

    // DB is source of truth. Queue the delayed job after insert.
    // If queueing fails, mark FAILED so we never leave a silent orphan SCHEDULED row.
    let job: EmailJobResult;
    try {
      const delay = Math.max(0, input.scheduledAt.getTime() - Date.now());
      job = await addDelayedEmailJob(email.id, delay);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enqueue email job';
      logger.error('BullMQ enqueue failed after DB insert', {
        emailId: email.id,
        message,
      });

      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: EmailStatus.FAILED,
          failedAt: new Date(),
          errorMessage: `Queue enqueue failed: ${message}`,
        },
      });

      throw new AppError('Failed to schedule email job', 503, { emailId: email.id });
    }

    try {
      email = await prisma.email.update({
        where: { id: email.id },
        data: { bullJobId: job.bullJobId },
      });
    } catch (err) {
      // Job id is deterministic (email.id), so cancel can still target the queue job.
      // Best effort: remove the orphaned queue job and mark FAILED so DB stays truthful.
      const message = err instanceof Error ? err.message : 'Failed to persist bullJobId';
      logger.error('Failed to persist bullJobId after enqueue', {
        emailId: email.id,
        bullJobId: job.bullJobId,
        message,
      });

      try {
        await removeEmailJob(email.id);
      } catch (removeErr) {
        logger.error('Failed to remove orphaned BullMQ job after bullJobId update failure', {
          emailId: email.id,
          message: removeErr instanceof Error ? removeErr.message : String(removeErr),
        });
      }

      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: EmailStatus.FAILED,
          failedAt: new Date(),
          errorMessage: `Failed to persist queue job id: ${message}`,
        },
      });

      throw new AppError('Failed to finalize email schedule', 503, { emailId: email.id });
    }

    // Best-effort Elasticsearch indexing for SCHEDULED status
    try {
      await ElasticsearchService.indexEmail(email, sender);
    } catch (indexErr) {
      logger.warn('Best-effort Elasticsearch index call failed during scheduleEmail', {
        emailId: email.id,
        message: indexErr instanceof Error ? indexErr.message : String(indexErr),
      });
    }

    logger.info('Email scheduled', {
      emailId: email.id,
      bullJobId: email.bullJobId,
      scheduledAt: email.scheduledAt.toISOString(),
    });

    return email;
  }

  async bulkScheduleEmails(input: {
    userId: string;
    senderId: string;
    recipients: string[];
    subject: string;
    body: string;
    startTime: Date;
    delayBetweenMs: number;
  }): Promise<{ scheduledCount: number; emails: Email[] }> {
    const { userId, senderId, recipients, subject, body, startTime, delayBetweenMs } = input;
    const scheduledEmails: Email[] = [];
    const now = Date.now();

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const scheduledAt = new Date(Math.max(now, startTime.getTime() + i * delayBetweenMs));
      const idempotencyKey = `bulk-${userId}-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;

      try {
        const email = await this.scheduleEmail({
          userId,
          senderId,
          recipient,
          subject,
          body,
          scheduledAt,
          idempotencyKey,
        });
        scheduledEmails.push(email);
      } catch (err) {
        logger.warn('Bulk schedule item failed', {
          recipient,
          index: i,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      scheduledCount: scheduledEmails.length,
      emails: scheduledEmails,
    };
  }

  async listScheduled(query: PaginationQuery, requestingUserId?: string): Promise<PaginatedEmails> {
    const finalQuery = requestingUserId ? { ...query, userId: requestingUserId } : query;
    return this.listByStatuses(finalQuery, [EmailStatus.SCHEDULED], { scheduledAt: 'asc' });
  }

  async listSent(query: PaginationQuery, requestingUserId?: string): Promise<PaginatedEmails> {
    const finalQuery = requestingUserId ? { ...query, userId: requestingUserId } : query;
    return this.listByStatuses(
      finalQuery,
      [EmailStatus.SENT, EmailStatus.FAILED],
      [{ sentAt: 'desc' }, { failedAt: 'desc' }, { updatedAt: 'desc' }],
    );
  }

  async searchEmails(query: SearchEmailsDto, requestingUserId?: string): Promise<SearchEmailsResult> {
    const finalQuery = requestingUserId ? { ...query, userId: requestingUserId } : query;
    return ElasticsearchService.searchEmails(finalQuery);
  }

  async getById(id: string, requestingUserId?: string): Promise<Email> {
    const email = await prisma.email.findUnique({ where: { id } });
    if (!email) {
      throw new AppError('Email not found', 404);
    }
    if (requestingUserId && email.userId !== requestingUserId) {
      throw new AppError('Email not found', 404);
    }
    return email;
  }

  async cancelEmail(id: string, requestingUserId?: string): Promise<Email> {
    const email = await this.getById(id, requestingUserId);

    if (email.status === EmailStatus.SENT) {
      throw new AppError('Cannot cancel an email that has already been sent', 409);
    }

    if (email.status === EmailStatus.CANCELLED) {
      throw new AppError('Email is already cancelled', 409);
    }

    if (email.status === EmailStatus.PROCESSING) {
      throw new AppError('Cannot cancel an email that is currently processing', 409);
    }

    if (email.status === EmailStatus.FAILED) {
      throw new AppError('Cannot cancel a failed email', 409);
    }

    // Prefer deterministic job id (email.id); fall back to stored bullJobId.
    const jobId = email.bullJobId ?? email.id;
    try {
      await removeEmailJob(jobId);
    } catch (err) {
      logger.warn('Failed to remove BullMQ job during cancel; continuing with DB cancel', {
        emailId: email.id,
        jobId,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const cancelledEmail = await prisma.email.update({
      where: { id: email.id },
      data: {
        status: EmailStatus.CANCELLED,
        errorMessage: email.errorMessage ?? 'Cancelled by user',
      },
    });

    // Best-effort Elasticsearch indexing for CANCELLED status
    try {
      await ElasticsearchService.indexEmail(cancelledEmail);
    } catch (indexErr) {
      logger.warn('Best-effort Elasticsearch index call failed during cancelEmail', {
        emailId: cancelledEmail.id,
        message: indexErr instanceof Error ? indexErr.message : String(indexErr),
      });
    }

    return cancelledEmail;
  }

  private async listByStatuses(
    query: PaginationQuery,
    statuses: EmailStatus[],
    orderBy: Prisma.EmailOrderByWithRelationInput | Prisma.EmailOrderByWithRelationInput[],
  ): Promise<PaginatedEmails> {
    const { page, limit, userId } = query;
    const where: Prisma.EmailWhereInput = {
      status: { in: statuses },
      ...(userId ? { userId } : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      pagination: buildPagination(page, limit, total),
    };
  }
}

export const emailService = new EmailService();
