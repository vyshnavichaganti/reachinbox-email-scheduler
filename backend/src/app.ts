import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { logger } from './lib/logger';
import { healthRouter } from './routes/health';
import { emailRouter } from './modules/emails/email.routes';
import { authRouter } from './modules/auth/auth.routes';
import { slackRouter } from './modules/slack/slack.routes';
import { senderRouter } from './modules/senders/sender.routes';
import { createDashboardRouter } from './routes/dashboard';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Bull Board admin dashboard UI assets
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: {
        write: (message: string) => logger.http(message.trim()),
      },
    }),
  );

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'ReachInbox API',
      docs: '/api/health',
      dashboard: '/admin/queues',
    });
  });

  app.use('/admin/queues', createDashboardRouter());
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/slack', slackRouter);
  app.use('/api/senders', senderRouter);
  app.use('/api/emails', emailRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
