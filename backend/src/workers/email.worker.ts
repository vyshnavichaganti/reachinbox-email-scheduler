import { Worker, type Job, type WorkerOptions } from 'bullmq';
import {
  EMAIL_JOB_NAME,
  QUEUE_NAMES,
  bullmqConnection,
  type EmailJobPayload,
} from '../lib/queue';
import { processScheduledEmail } from '../modules/emails/email.processor';
import { logger } from '../lib/logger';
import { ensureEmailIndex } from '../lib/emailSearch';
import { env } from '../config/env';

let emailWorker: Worker<EmailJobPayload> | null = null;

async function handleEmailJob(job: Job<EmailJobPayload>): Promise<ProcessJobSummary> {
  const emailId = job.data?.emailId ?? job.id;

  if (!emailId || typeof emailId !== 'string') {
    throw new Error('Invalid email job payload: emailId is required');
  }

  logger.info('Email job received by worker', {
    jobId: job.id,
    emailId,
    attemptsMade: job.attemptsMade,
  });

  const result = await processScheduledEmail(emailId);

  if (result.outcome === 'skipped') {
    if (result.reason === 'already_sent') {
      logger.info('Email skipped because SENT', { jobId: job.id, emailId });
    } else if (result.reason === 'cancelled') {
      logger.info('Email skipped because CANCELLED', { jobId: job.id, emailId });
    } else {
      logger.info('Email job skipped', { jobId: job.id, emailId, reason: result.reason });
    }
  }

  if (result.outcome === 'rescheduled') {
    logger.info('Email job rescheduled due to rate limit', {
      jobId: job.id,
      emailId,
      reason: result.reason,
      msUntilNextHour: result.msUntilNextHour,
      nextAvailableTime: result.nextAvailableTime,
    });
    return {
      outcome: 'rescheduled',
      emailId,
      reason: result.reason,
    };
  }

  if (result.outcome === 'failed') {
    logger.error('Email job failed on processor execution', {
      jobId: job.id,
      emailId,
      error: result.error,
      attemptsMade: job.attemptsMade,
    });
    // Throw so BullMQ marks attempt as failed and schedules a retry according to backoff options
    throw new Error(result.error);
  }

  return {
    outcome: result.outcome,
    emailId,
    reason: result.outcome === 'skipped' ? result.reason : undefined,
  };
}

export type ProcessJobSummary = {
  outcome: string;
  emailId: string;
  reason?: string;
};

export async function startEmailWorker(concurrency?: number): Promise<Worker<EmailJobPayload>> {
  if (emailWorker) {
    return emailWorker;
  }

  try {
    await ensureEmailIndex();
  } catch (err) {
    logger.warn('Could not ensure Elasticsearch email index at worker start', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const workerConcurrency = concurrency ?? env.WORKER_CONCURRENCY;

  const options: WorkerOptions = {
    connection: bullmqConnection,
    concurrency: workerConcurrency,
  };

  emailWorker = new Worker<EmailJobPayload>(QUEUE_NAMES.EMAIL, handleEmailJob, options);

  emailWorker.on('completed', (job, result) => {
    logger.info('Email job completed successfully', {
      jobId: job.id,
      result,
    });
  });

  emailWorker.on('failed', (job, err) => {
    logger.error('Email job failed in BullMQ worker', {
      jobId: job?.id,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  emailWorker.on('error', (err) => {
    logger.error('Email worker system error', { message: err.message });
  });

  logger.info('Email worker started', {
    queue: QUEUE_NAMES.EMAIL,
    jobName: EMAIL_JOB_NAME,
    concurrency: workerConcurrency,
  });

  return emailWorker;
}

export async function stopEmailWorker(): Promise<void> {
  if (!emailWorker) {
    return;
  }
  await emailWorker.close();
  emailWorker = null;
  logger.info('Email worker stopped');
}
