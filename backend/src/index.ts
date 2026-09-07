import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { connectPrisma, disconnectPrisma } from './lib/prisma';
import { disconnectRedis } from './lib/redis';
import { closeQueues, getEmailQueue } from './lib/queue';
import { startEmailWorker, stopEmailWorker } from './workers/email.worker';

async function bootstrap(): Promise<void> {
  await connectPrisma();
  getEmailQueue();
  await startEmailWorker();

  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server listening on ${env.BACKEND_URL} (port ${env.PORT}, host 0.0.0.0)`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      try {
        await stopEmailWorker();
        await closeQueues();
        await disconnectRedis();
        await disconnectPrisma();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', {
          message: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { message: err.message, stack: err.stack });
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
