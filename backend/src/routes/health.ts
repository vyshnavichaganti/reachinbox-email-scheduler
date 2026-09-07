import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { pingRedis } from '../lib/redis';
import { getEmailQueue } from '../lib/queue';
import { pingElasticsearch } from '../lib/elasticsearch';
import { env } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const checks: Record<string, 'up' | 'down'> = {
      api: 'up',
      postgres: 'down',
      redis: 'down',
      bullmq: 'down',
      elasticsearch: 'down',
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'up';
    } catch {
      checks.postgres = 'down';
    }

    try {
      checks.redis = (await pingRedis()) ? 'up' : 'down';
    } catch {
      checks.redis = 'down';
    }

    try {
      const queue = getEmailQueue();
      await queue.getJobCounts();
      checks.bullmq = 'up';
    } catch {
      checks.bullmq = 'down';
    }

    try {
      checks.elasticsearch = (await pingElasticsearch()) ? 'up' : 'down';
    } catch {
      checks.elasticsearch = 'down';
    }

    const healthy = Object.values(checks).every((status) => status === 'up');

    res.status(healthy ? 200 : 503).json({
      success: healthy,
      service: 'reachinbox-backend',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (err) {
    next(err);
  }
});
