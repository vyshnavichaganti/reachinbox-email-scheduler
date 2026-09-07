import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { SlackService } from '../src/services/slack.service';

const {
  mockUserFindUnique,
  mockSenderFindUnique,
  mockSlackConnectionFindUnique,
  mockSlackConnectionUpsert,
  mockSlackConnectionDelete,
  mockRedisGet,
  mockRedisSet,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockSenderFindUnique: vi.fn(),
  mockSlackConnectionFindUnique: vi.fn(),
  mockSlackConnectionUpsert: vi.fn(),
  mockSlackConnectionDelete: vi.fn(),
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    sender: { findUnique: mockSenderFindUnique },
    slackConnection: {
      findUnique: mockSlackConnectionFindUnique,
      upsert: mockSlackConnectionUpsert,
      delete: mockSlackConnectionDelete,
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
  connectPrisma: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

vi.mock('../src/lib/queue', () => ({
  QUEUE_NAMES: { EMAIL: 'emailQueue' },
  getEmailQueue: vi.fn(() => ({
    getJobCounts: vi.fn().mockResolvedValue({}),
  })),
  addDelayedEmailJob: vi.fn(),
  removeEmailJob: vi.fn(),
  closeQueues: vi.fn(),
  bullmqConnection: {},
}));

vi.mock('../src/lib/redis', () => ({
  redis: {
    status: 'ready',
    on: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
    get: mockRedisGet,
    set: mockRedisSet,
  },
  pingRedis: vi.fn().mockResolvedValue(true),
  disconnectRedis: vi.fn(),
}));

vi.mock('../src/lib/elasticsearch', () => ({
  elasticsearch: {},
  pingElasticsearch: vi.fn().mockResolvedValue(true),
  connectElasticsearch: vi.fn(),
}));

vi.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4000,
    FRONTEND_URL: 'http://localhost:3000',
    BACKEND_URL: 'http://localhost:4000',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    ELASTICSEARCH_NODE: 'http://localhost:9200',
    SESSION_SECRET: 'test-secret',
    JWT_SECRET: 'test-secret',
    GOOGLE_CLIENT_ID: 'mock-google-client-id',
    GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/api/auth/google/callback',
    SLACK_CLIENT_ID: 'mock-slack-client-id',
    SLACK_CLIENT_SECRET: 'mock-slack-client-secret',
    SLACK_REDIRECT_URI: 'http://localhost:4000/api/slack/callback',
  },
}));

const app = createApp();

const user = {
  id: 'user_1',
  googleId: 'google_1',
  name: 'Test User',
  email: 'test@example.com',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sender = {
  id: 'sender_1',
  userId: 'user_1',
  email: 'sender@example.com',
  displayName: 'Test Sender',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const slackConn = {
  id: 'slack_1',
  userId: 'user_1',
  slackTeamId: 'T12345',
  slackUserId: 'U12345',
  teamName: 'Acme Corp',
  accessToken: 'xoxb-secret-token-12345',
  webhookUrl: 'https://hooks.slack.com/services/T123/B456/789',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function generateToken(userId: string): string {
  return jwt.sign({ userId }, 'test-secret', { expiresIn: '7d' });
}

describe('Slack Integration API & Service (/api/slack)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(user);
    mockSenderFindUnique.mockResolvedValue(sender);
  });

  describe('GET /api/slack/connect', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/slack/connect');
      expect(res.status).toBe(401);
    });

    it('redirects to Slack OAuth consent page when authenticated', async () => {
      const token = generateToken(user.id);
      const res = await request(app)
        .get('/api/slack/connect')
        .set('Cookie', [`reachinbox_session=${token}`]);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('slack.com/oauth/v2/authorize');
      expect(res.headers.location).toContain('mock-slack-client-id');
    });
  });

  describe('GET /api/slack/status', () => {
    it('returns connected: false when user has no Slack connection', async () => {
      mockSlackConnectionFindUnique.mockResolvedValue(null);
      const token = generateToken(user.id);

      const res = await request(app)
        .get('/api/slack/status')
        .set('Cookie', [`reachinbox_session=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ connected: false });
    });

    it('returns connected: true with teamName and NEVER leaks access token', async () => {
      mockSlackConnectionFindUnique.mockResolvedValue({
        teamName: 'Acme Corp',
      });
      const token = generateToken(user.id);

      const res = await request(app)
        .get('/api/slack/status')
        .set('Cookie', [`reachinbox_session=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(true);
      expect(res.body.data.teamName).toBe('Acme Corp');
      expect(res.body.data.accessToken).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('xoxb');
    });
  });

  describe('DELETE /api/slack/disconnect', () => {
    it('deletes SlackConnection record from DB', async () => {
      mockSlackConnectionDelete.mockResolvedValue(slackConn);
      const token = generateToken(user.id);

      const res = await request(app)
        .delete('/api/slack/disconnect')
        .set('Cookie', [`reachinbox_session=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSlackConnectionDelete).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
    });
  });

  describe('SlackService.sendRateLimitNotification', () => {
    it('returns false if sender or user has no Slack connection', async () => {
      mockSlackConnectionFindUnique.mockResolvedValue(null);

      const result = await SlackService.sendRateLimitNotification({
        userId: 'user_1',
        senderId: 'sender_1',
        senderEmail: 'sender@example.com',
      });

      expect(result).toBe(false);
    });

    it('deduplicates Slack notifications in the same hour window using Redis key', async () => {
      mockSlackConnectionFindUnique.mockResolvedValue(slackConn);
      // Redis key already exists (already notified this hour)
      mockRedisGet.mockResolvedValue('1');

      const result = await SlackService.sendRateLimitNotification({
        userId: 'user_1',
        senderId: 'sender_1',
        senderEmail: 'sender@example.com',
      });

      expect(result).toBe(false);
    });

    it('is fault-tolerant and returns false on external Slack request errors without throwing', async () => {
      mockSlackConnectionFindUnique.mockRejectedValue(new Error('DB Connection Lost'));

      const result = await SlackService.sendRateLimitNotification({
        userId: 'user_1',
        senderId: 'sender_1',
        senderEmail: 'sender@example.com',
      });

      expect(result).toBe(false);
    });
  });
});
