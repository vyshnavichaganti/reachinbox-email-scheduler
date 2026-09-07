import { env } from './config/env';
import { logger } from './lib/logger';
import { connectPrisma, disconnectPrisma } from './lib/prisma';
import { disconnectRedis } from './lib/redis';
import { closeQueues } from './lib/queue';
import { startEmailWorker, stopEmailWorker } from './workers/email.worker';

/**
 * Standalone worker process.
 * Connects to PostgreSQL, Redis, and BullMQ to process scheduled email jobs.
 */
async function bootstrapWorker(): Promise<void> {
  await connectPrisma();
  await startEmailWorker();

  logger.info('Standalone email worker running', {
    env: env.NODE_ENV,
    queue: 'emailQueue',
    concurrency: env.WORKER_CONCURRENCY,
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — gracefully shutting down worker process`);
    try {
      await stopEmailWorker();
      await closeQueues();
      await disconnectRedis();
      await disconnectPrisma();
      logger.info('Worker process shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Worker shutdown error', {
        message: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrapWorker().catch((err) => {
  logger.error('Failed to start email worker', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
