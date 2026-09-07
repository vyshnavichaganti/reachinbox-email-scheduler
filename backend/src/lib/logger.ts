import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, errors, colorize, printf, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${stack ?? message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'reachinbox-backend' },
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? combine(timestamp(), errors({ stack: true }), json())
          : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), consoleFormat),
    }),
  ],
});
