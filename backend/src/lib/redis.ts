import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('connect', () => {
  logger.info('Redis connecting…');
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('error', (err: Error) => {
  logger.error('Redis error', { message: err.message });
});

export async function pingRedis(): Promise<boolean> {
  const result = await redis.ping();
  return result === 'PONG';
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis disconnected');
}
