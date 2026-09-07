import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { EmailStatus } from '@prisma/client';

const {
  mockEsIndex,
  mockEsIndicesExists,
  mockEsIndicesCreate,
  mockEsSearch,
  mockUserFindUnique,
  mockSenderFindUnique,
  mockEmailFindUnique,
  mockEmailUpdateMany,
  mockEmailUpdate,
  mockSendEmail,
  mockAddDelayedEmailJob,
} = vi.hoisted(() => ({
  mockEsIndex: vi.fn(),
  mockEsIndicesExists: vi.fn(),
  mockEsIndicesCreate: vi.fn(),
  mockEsSearch: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockSenderFindUnique: vi.fn(),
  mockEmailFindUnique: vi.fn(),
  mockEmailUpdateMany: vi.fn(),
  mockEmailUpdate: vi.fn(),
  mockSendEmail: vi.fn(),
  mockAddDelayedEmailJob: vi.fn(),
}));

vi.mock('../src/lib/elasticsearch', () => ({
  elasticsearch: {
    index: mockEsIndex,
    search: mockEsSearch,
    indices: {
      exists: mockEsIndicesExists,
      create: mockEsIndicesCreate,
    },
  },
  pingElasticsearch: vi.fn().mockResolvedValue(true),
  connectElasticsearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    sender: { findUnique: mockSenderFindUnique },
    email: {
      findUnique: mockEmailFindUnique,
      updateMany: mockEmailUpdateMany,
      update: mockEmailUpdate,
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../src/lib/queue', () => ({
  QUEUE_NAMES: { EMAIL: 'emailQueue' },
  getEmailQueue: vi.fn(() => ({
    name: 'emailQueue',
    getName: () => 'emailQueue',
    client: {},
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
    isPaused: vi.fn().mockResolvedValue(false),
    getJobs: vi.fn().mockResolvedValue([]),
    toKey: (key: string) => `bull:${key}`,
  })),
  addDelayedEmailJob: mockAddDelayedEmailJob,
  removeEmailJob: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/lib/redis', () => ({
  redis: { status: 'offline', on: vi.fn(), ping: vi.fn(), quit: vi.fn(), eval: vi.fn() },
  pingRedis: vi.fn().mockResolvedValue(true),
  disconnectRedis: vi.fn(),
}));

vi.mock('../src/integrations/email/smtp.service', () => ({
  sendEmail: mockSendEmail,
}));

import { ElasticsearchService } from '../src/services/elasticsearch.service';
import { processScheduledEmail } from '../src/modules/emails/email.processor';
import { createApp } from '../src/app';

const app = createApp();

const sender = {
  id: 'sender_1',
  userId: 'user_1',
  email: 'sender@reachinbox.local',
  displayName: 'Demo Sender',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeEmail(status: EmailStatus, overrides: Record<string, unknown> = {}) {
  return {
    id: 'email_1',
    userId: 'user_1',
    senderId: 'sender_1',
    recipient: 'test@example.com',
    subject: 'Welcome to ReachInbox',
    body: 'Hello John, welcome aboard!',
    scheduledAt: new Date(),
    status,
    bullJobId: 'email_1',
    idempotencyKey: 'key-1',
    sentAt: status === EmailStatus.SENT ? new Date() : null,
    failedAt: status === EmailStatus.FAILED ? new Date() : null,
    errorMessage: status === EmailStatus.FAILED ? 'SMTP connection refused' : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender,
    ...overrides,
  };
}

describe('Stage 5 Elasticsearch & Bull Board Dashboard Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEsIndicesExists.mockResolvedValue(true);
    mockEsIndex.mockResolvedValue({ result: 'created' });
    mockSendEmail.mockResolvedValue({
      messageId: '<msg@ethereal>',
      previewUrl: false,
      accepted: ['test@example.com'],
      rejected: [],
    });
  });

  it('1. Scheduled email triggers Elasticsearch indexing call', async () => {
    const scheduled = makeEmail(EmailStatus.SCHEDULED);
    await ElasticsearchService.indexEmail(scheduled, sender);

    expect(mockEsIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'emails',
        id: 'email_1',
        document: expect.objectContaining({
          id: 'email_1',
          recipient: 'test@example.com',
          status: EmailStatus.SCHEDULED,
        }),
      }),
    );
  });

  it('2. SENT status update is indexed in Elasticsearch', async () => {
    const scheduled = makeEmail(EmailStatus.SCHEDULED);
    const sent = makeEmail(EmailStatus.SENT);

    mockEmailFindUnique.mockResolvedValue(scheduled);
    mockEmailUpdateMany.mockResolvedValue({ count: 1 });
    mockEmailUpdate.mockResolvedValue(sent);

    const result = await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(result.outcome).toBe('sent');
    expect(mockEsIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'emails',
        id: 'email_1',
        document: expect.objectContaining({
          status: EmailStatus.SENT,
        }),
      }),
    );
  });

  it('3. FAILED status update is indexed in Elasticsearch', async () => {
    const scheduled = makeEmail(EmailStatus.SCHEDULED);
    const failed = makeEmail(EmailStatus.FAILED);

    mockEmailFindUnique.mockResolvedValue(scheduled);
    mockEmailUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'));
    mockEmailUpdate.mockResolvedValue(failed);

    const result = await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(result.outcome).toBe('failed');
    expect(mockEsIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'emails',
        document: expect.objectContaining({
          status: EmailStatus.FAILED,
        }),
      }),
    );
  });

  it('4. CANCELLED status update is indexed in Elasticsearch', async () => {
    const cancelled = makeEmail(EmailStatus.CANCELLED);
    await ElasticsearchService.indexEmail(cancelled, sender);

    expect(mockEsIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({
          status: EmailStatus.CANCELLED,
        }),
      }),
    );
  });

  it('5. Elasticsearch indexing failure does NOT cause email sending to fail', async () => {
    const scheduled = makeEmail(EmailStatus.SCHEDULED);
    const sent = makeEmail(EmailStatus.SENT);

    mockEmailFindUnique.mockResolvedValue(scheduled);
    mockEmailUpdateMany.mockResolvedValue({ count: 1 });
    mockEmailUpdate.mockResolvedValue(sent);
    mockEsIndex.mockRejectedValueOnce(new Error('ES node unreachable'));

    const result = await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(result.outcome).toBe('sent');
  });

  it('6. Search endpoint GET /api/emails/search executes search query', async () => {
    mockEsSearch.mockResolvedValue({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _source: {
              id: 'email_1',
              recipient: 'john@example.com',
              subject: 'Hello John',
              body: 'Welcome',
              status: EmailStatus.SENT,
              scheduledAt: new Date().toISOString(),
              sentAt: new Date().toISOString(),
              failedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      },
    });

    const res = await request(app)
      .get('/api/emails/search')
      .query({ q: 'john', page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('7. Search endpoint validates invalid parameters', async () => {
    const res = await request(app)
      .get('/api/emails/search')
      .query({ page: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('8. Bull Board dashboard is mounted at /admin/queues', async () => {
    const res = await request(app).get('/admin/queues');
    expect(res.status).not.toBe(404);
  });
});
