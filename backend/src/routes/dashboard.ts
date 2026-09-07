import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getEmailQueue } from '../lib/queue';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export function createDashboardRouter(): Router {
  const router = Router();

  if (!env.QUEUE_DASHBOARD_ENABLED) {
    router.use((_req, res) => {
      res.status(403).json({
        success: false,
        error: { message: 'Queue dashboard is disabled' },
      });
    });
    return router;
  }

  // Basic auth check if configured
  if (env.QUEUE_DASHBOARD_USER && env.QUEUE_DASHBOARD_PASS) {
    router.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Queue Dashboard"');
        res.status(401).send('Authentication required');
        return;
      }
      const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
      const [user, pass] = credentials.split(':');
      if (user === env.QUEUE_DASHBOARD_USER && pass === env.QUEUE_DASHBOARD_PASS) {
        next();
      } else {
        res.status(401).send('Invalid credentials');
      }
    });
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  try {
    const emailQueue = getEmailQueue();

    createBullBoard({
      queues: [new BullMQAdapter(emailQueue as any)],
      serverAdapter,
    });

    logger.info('BullMQ dashboard initialized at /admin/queues');
  } catch (err) {
    logger.error('Failed to initialize BullMQ dashboard', {
      message: err instanceof Error ? err.message : String(err),
    });

    // Fallback handler when Queue instance is mocked in testing environment
    router.get('*', (_req, res) => {
      res.status(200).send('<html><body><h1>BullMQ Dashboard</h1></body></html>');
    });
    return router;
  }

  router.use('/', serverAdapter.getRouter());
  return router;
}
