import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const redisUrlDefault = (process.env.REDIS_URL || process.env.REDISURL || process.env.REDIS_PRIVATE_URL || process.env.REDIS_PUBLIC_URL || '').trim();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  BACKEND_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().optional().default(redisUrlDefault),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().optional().default(''),

  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().optional().default(''),

  SESSION_SECRET: z.string().min(1).default('change-me-to-a-long-random-string'),
  JWT_SECRET: z.string().min(1).default('change-me-to-another-long-random-string'),

  SMTP_HOST: z.string().default('smtp.ethereal.email'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().default('ReachInbox <noreply@reachinbox.local>'),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  WORKER_MAX_RETRIES: z.coerce.number().int().positive().default(3),
  WORKER_BACKOFF_DELAY_MS: z.coerce.number().int().positive().default(5000),

  MIN_SEND_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(200),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(100),

  QUEUE_DASHBOARD_ENABLED: z.coerce.boolean().default(true),
  QUEUE_DASHBOARD_USER: z.string().optional().default(''),
  QUEUE_DASHBOARD_PASS: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;
