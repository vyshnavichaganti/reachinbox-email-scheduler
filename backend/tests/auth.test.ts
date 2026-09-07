import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { EmailStatus } from '@prisma/client';

const {
  mockUserFindUnique,
  mockUserCreate,
  mockUserUpdate,
  mockEmailFindUnique,
  mockEmailUpdate,
  mockRemoveEmailJob,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockEmailFindUnique: vi.fn(),
  mockEmailUpdate: vi.fn(),
  mockRemoveEmailJob: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
    },
    email: {
      findUnique: mockEmailFindUnique,
      update: mockEmailUpdate,
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
  removeEmailJob: mockRemoveEmailJob,
  closeQueues: vi.fn(),
  bullmqConnection: {},
}));

vi.mock('../src/lib/redis', () => ({
  redis: { on: vi.fn(), ping: vi.fn(), quit: vi.fn(), get: vi.fn(), set: vi.fn() },
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

const userA = {
  id: 'user_A',
  googleId: 'google_123',
  name: 'User A',
  email: 'usera@example.com',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const userB = {
  id: 'user_B',
  googleId: 'google_456',
  name: 'User B',
  email: 'userb@example.com',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function generateToken(userId: string): string {
  return jwt.sign({ userId }, 'test-secret', { expiresIn: '7d' });
}

describe('Auth API & Tenant Isolation (/api/auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when no session cookie or token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns user profile when valid session token cookie is provided', async () => {
      mockUserFindUnique.mockResolvedValue(userA);
      const token = generateToken(userA.id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`reachinbox_session=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userA.id);
      expect(res.body.data.email).toBe(userA.email);
    });

    it('returns user profile when Bearer header is provided', async () => {
      mockUserFindUnique.mockResolvedValue(userA);
      const token = generateToken(userA.id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userA.id);
    });
  });

  describe('GET /api/auth/google', () => {
    it('redirects to Google OAuth consent page', async () => {
      const res = await request(app).get('/api/auth/google');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(res.headers.location).toContain('mock-google-client-id');
    });
  });

  describe('GET /api/auth/google/callback', () => {
    it('returns safe error details (status, error, error_description) when Google token exchange fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({
          error: 'redirect_uri_mismatch',
          error_description: 'The redirect URI in the request did not match',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await request(app).get('/api/auth/google/callback?code=invalid_code');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Google authentication failed');
      expect(res.body.error.details).toEqual({
        status: 400,
        error: 'redirect_uri_mismatch',
        error_description: 'The redirect URI in the request did not match',
      });
      expect(JSON.stringify(res.body)).not.toContain('mock-google-client-secret');
      expect(JSON.stringify(res.body)).not.toContain('invalid_code');
      expect(JSON.stringify(res.body)).not.toContain('access_token');
      expect(JSON.stringify(res.body)).not.toContain('refresh_token');

      vi.unstubAllGlobals();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears reachinbox_session cookie and returns success', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']?.[0]).toContain('reachinbox_session=;');
    });
  });

  describe('Tenant Isolation on /api/emails', () => {
    it('prevents User A from accessing User B email by ID', async () => {
      mockUserFindUnique.mockResolvedValue(userA);
      mockEmailFindUnique.mockResolvedValue({
        id: 'email_belonging_to_B',
        userId: userB.id,
        senderId: 'sender_B',
        recipient: 'test@example.com',
        subject: 'Secret',
        body: 'Body',
        status: EmailStatus.SCHEDULED,
        bullJobId: null,
        idempotencyKey: 'key-b',
        scheduledAt: new Date(),
        sentAt: null,
        failedAt: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const tokenA = generateToken(userA.id);
      const res = await request(app)
        .get('/api/emails/email_belonging_to_B')
        .set('Cookie', [`reachinbox_session=${tokenA}`]);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('prevents User A from cancelling User B email', async () => {
      mockUserFindUnique.mockResolvedValue(userA);
      mockEmailFindUnique.mockResolvedValue({
        id: 'email_belonging_to_B',
        userId: userB.id,
        senderId: 'sender_B',
        recipient: 'test@example.com',
        subject: 'Secret',
        body: 'Body',
        status: EmailStatus.SCHEDULED,
        bullJobId: null,
        idempotencyKey: 'key-b',
        scheduledAt: new Date(),
        sentAt: null,
        failedAt: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const tokenA = generateToken(userA.id);
      const res = await request(app)
        .delete('/api/emails/email_belonging_to_B')
        .set('Cookie', [`reachinbox_session=${tokenA}`]);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(mockEmailUpdate).not.toHaveBeenCalled();
    });
  });
});
