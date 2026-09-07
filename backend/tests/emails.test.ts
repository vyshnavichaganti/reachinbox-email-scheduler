import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { EmailStatus } from '@prisma/client';
import { createApp } from '../src/app';
import { AppError } from '../src/lib/errors';

const {
  mockUserFindUnique,
  mockSenderFindUnique,
  mockEmailFindUnique,
  mockEmailCreate,
  mockEmailUpdate,
  mockEmailCount,
  mockEmailFindMany,
  mockTransaction,
  mockAddDelayedEmailJob,
  mockRemoveEmailJob,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockSenderFindUnique: vi.fn(),
  mockEmailFindUnique: vi.fn(),
  mockEmailCreate: vi.fn(),
  mockEmailUpdate: vi.fn(),
  mockEmailCount: vi.fn(),
  mockEmailFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockAddDelayedEmailJob: vi.fn(),
  mockRemoveEmailJob: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    sender: { findUnique: mockSenderFindUnique },
    email: {
      findUnique: mockEmailFindUnique,
      create: mockEmailCreate,
      update: mockEmailUpdate,
      count: mockEmailCount,
      findMany: mockEmailFindMany,
    },
    $transaction: mockTransaction,
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
  addDelayedEmailJob: mockAddDelayedEmailJob,
  removeEmailJob: mockRemoveEmailJob,
  closeQueues: vi.fn(),
  bullmqConnection: {},
}));

vi.mock('../src/lib/redis', () => ({
  redis: { on: vi.fn(), ping: vi.fn(), quit: vi.fn() },
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
    SESSION_SECRET: 'test',
    JWT_SECRET: 'test',
    SMTP_HOST: 'smtp.ethereal.email',
    SMTP_PORT: 587,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: 'test@example.com',
  },
}));

const app = createApp();

const user = {
  id: 'user_1',
  googleId: null,
  name: 'Demo',
  email: 'demo@reachinbox.local',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sender = {
  id: 'sender_1',
  userId: 'user_1',
  email: 'sender@reachinbox.local',
  displayName: 'Demo Sender',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function futureIso(hours = 2): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeEmail(overrides: Record<string, unknown> = {}) {
  const scheduledAt = new Date(futureIso());
  return {
    id: 'email_1',
    userId: user.id,
    senderId: sender.id,
    recipient: 'test@example.com',
    subject: 'Test Email',
    body: 'Hello',
    scheduledAt,
    status: EmailStatus.SCHEDULED,
    bullJobId: null,
    idempotencyKey: 'unique-key-1',
    sentAt: null,
    failedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('POST /api/emails/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(user);
    mockSenderFindUnique.mockResolvedValue(sender);
    mockEmailFindUnique.mockResolvedValue(null);
    mockAddDelayedEmailJob.mockResolvedValue({ bullJobId: 'email_1', delay: 1000 });
  });

  it('schedules a valid email, stores it, and creates a BullMQ delayed job', async () => {
    const created = makeEmail({ bullJobId: null });
    const finalized = makeEmail({ bullJobId: 'email_1' });
    mockEmailCreate.mockResolvedValue(created);
    mockEmailUpdate.mockResolvedValue(finalized);

    const res = await request(app).post('/api/emails/schedule').send({
      userId: user.id,
      senderId: sender.id,
      recipient: 'test@example.com',
      subject: 'Test Email',
      body: 'Hello',
      scheduledAt: futureIso(),
      idempotencyKey: 'unique-key-1',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('email_1');
    expect(res.body.data.status).toBe(EmailStatus.SCHEDULED);
    expect(res.body.data.bullJobId).toBe('email_1');
    expect(mockEmailCreate).toHaveBeenCalledOnce();
    expect(mockAddDelayedEmailJob).toHaveBeenCalledOnce();
    expect(mockAddDelayedEmailJob.mock.calls[0][0]).toBe('email_1');
    expect(mockAddDelayedEmailJob.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
    expect(mockEmailUpdate).toHaveBeenCalledWith({
      where: { id: 'email_1' },
      data: { bullJobId: 'email_1' },
    });
  });

  it('rejects an invalid recipient', async () => {
    const res = await request(app).post('/api/emails/schedule').send({
      userId: user.id,
      senderId: sender.id,
      recipient: 'not-an-email',
      subject: 'Test Email',
      body: 'Hello',
      scheduledAt: futureIso(),
      idempotencyKey: 'unique-key-2',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockEmailCreate).not.toHaveBeenCalled();
    expect(mockAddDelayedEmailJob).not.toHaveBeenCalled();
  });

  it('rejects an invalid scheduledAt', async () => {
    const res = await request(app).post('/api/emails/schedule').send({
      userId: user.id,
      senderId: sender.id,
      recipient: 'test@example.com',
      subject: 'Test Email',
      body: 'Hello',
      scheduledAt: 'not-a-date',
      idempotencyKey: 'unique-key-3',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockEmailCreate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate idempotencyKey', async () => {
    mockEmailFindUnique.mockResolvedValue(makeEmail({ idempotencyKey: 'dup-key' }));

    const res = await request(app).post('/api/emails/schedule').send({
      userId: user.id,
      senderId: sender.id,
      recipient: 'test@example.com',
      subject: 'Test Email',
      body: 'Hello',
      scheduledAt: futureIso(),
      idempotencyKey: 'dup-key',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/idempotencyKey/i);
    expect(mockEmailCreate).not.toHaveBeenCalled();
    expect(mockAddDelayedEmailJob).not.toHaveBeenCalled();
  });
});

describe('GET /api/emails/scheduled and /sent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves scheduled emails with pagination', async () => {
    const scheduled = [makeEmail({ id: 'email_sched', status: EmailStatus.SCHEDULED })];
    mockTransaction.mockResolvedValue([1, scheduled]);

    const res = await request(app).get('/api/emails/scheduled').query({ page: 1, limit: 20 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe(EmailStatus.SCHEDULED);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('retrieves sent/failed emails with pagination', async () => {
    const sent = [
      makeEmail({
        id: 'email_sent',
        status: EmailStatus.SENT,
        sentAt: new Date(),
        bullJobId: 'email_sent',
      }),
      makeEmail({
        id: 'email_failed',
        status: EmailStatus.FAILED,
        failedAt: new Date(),
        errorMessage: 'boom',
      }),
    ];
    mockTransaction.mockResolvedValue([2, sent]);

    const res = await request(app).get('/api/emails/sent').query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.totalPages).toBe(1);
  });
});

describe('EmailService queue consistency helpers', () => {
  it('exposes AppError for operational failures', () => {
    const err = new AppError('test', 400);
    expect(err.statusCode).toBe(400);
    expect(err.isOperational).toBe(true);
  });
});
