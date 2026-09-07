import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { env } from '../config/env';
import { logger } from './logger';

export const QUEUE_NAMES = {
  EMAIL: 'emailQueue',
} as const;

export const EMAIL_JOB_NAME = 'send-scheduled-email' as const;

export type EmailJobPayload = {
  emailId: string;
};

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const bullmqConnection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
};

export type EmailJobResult = {
  bullJobId: string;
  delay: number;
};

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: bullmqConnection });
    queues.set(name, queue);
    logger.info(`BullMQ queue initialized: ${name}`);
  }
  return queue;
}

/** Dedicated delayed-email queue (BullMQ delays — not cron). */
export function getEmailQueue(): Queue {
  return getQueue(QUEUE_NAMES.EMAIL);
}

export async function addDelayedEmailJob(emailId: string, delayMs: number): Promise<EmailJobResult> {
  const queue = getEmailQueue();
  const delay = Math.max(0, delayMs);
  const payload: EmailJobPayload = { emailId };

  const options: JobsOptions = {
    jobId: emailId,
    delay,
    removeOnComplete: true,
    removeOnFail: false,
    attempts: env.WORKER_MAX_RETRIES,
    backoff: {
      type: 'exponential',
      delay: env.WORKER_BACKOFF_DELAY_MS,
    },
  };

  const job = await queue.add(EMAIL_JOB_NAME, payload, options);

  return {
    bullJobId: String(job.id),
    delay,
  };
}

export async function removeEmailJob(jobId: string): Promise<boolean> {
  const queue = getEmailQueue();
  const job = await queue.getJob(jobId);
  if (!job) {
    return false;
  }
  await job.remove();
  return true;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
  logger.info('BullMQ queues closed');
}
