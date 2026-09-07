import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailStatus } from '@prisma/client';

const {
  mockFindUnique,
  mockUpdateMany,
  mockUpdate,
  mockSendEmail,
  mockIndexEmailDocument,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendEmail: vi.fn(),
  mockIndexEmailDocument: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    email: {
      findUnique: mockFindUnique,
      updateMany: mockUpdateMany,
      update: mockUpdate,
    },
  },
}));

vi.mock('../src/integrations/email/smtp.service', () => ({
  sendEmail: mockSendEmail,
  getMailTransporter: vi.fn(),
  resetMailTransporterForTests: vi.fn(),
}));

vi.mock('../src/lib/emailSearch', () => ({
  indexEmailDocument: mockIndexEmailDocument,
  ensureEmailIndex: vi.fn(),
}));

vi.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    SMTP_FROM: 'ReachInbox <noreply@reachinbox.local>',
    WORKER_CONCURRENCY: 5,
    WORKER_MAX_RETRIES: 3,
    WORKER_BACKOFF_DELAY_MS: 5000,
    MIN_SEND_DELAY_MS: 0,
    MAX_EMAILS_PER_HOUR: 200,
    MAX_EMAILS_PER_HOUR_PER_SENDER: 100,
  },
}));

vi.mock('../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

import { processScheduledEmail } from '../src/modules/emails/email.processor';

const sender = {
  id: 'sender_1',
  userId: 'user_1',
  email: 'sender@reachinbox.local',
  displayName: 'Demo',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeEmail(status: EmailStatus, overrides: Record<string, unknown> = {}) {
  return {
    id: 'email_1',
    userId: 'user_1',
    senderId: 'sender_1',
    recipient: 'test@example.com',
    subject: 'Hello',
    body: 'Body',
    scheduledAt: new Date(),
    status,
    bullJobId: 'email_1',
    idempotencyKey: 'key-1',
    sentAt: null,
    failedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender,
    ...overrides,
  };
}

describe('Stage 3 Email Worker & Idempotency Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexEmailDocument.mockResolvedValue(undefined);
  });

  it('1. SENT email is not sent again (idempotent skip)', async () => {
    mockFindUnique.mockResolvedValue(makeEmail(EmailStatus.SENT, { sentAt: new Date() }));

    const result = await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(result.outcome).toBe('skipped');
    if (result.outcome === 'skipped') {
      expect(result.reason).toBe('already_sent');
    }
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('2. CANCELLED email is not sent', async () => {
    mockFindUnique.mockResolvedValue(makeEmail(EmailStatus.CANCELLED));

    const result = await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(result.outcome).toBe('skipped');
    if (result.outcome === 'skipped') {
      expect(result.reason).toBe('cancelled');
    }
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('3. SCHEDULED email can be atomically claimed to PROCESSING', async () => {
    const scheduled = makeEmail(EmailStatus.SCHEDULED);
    const sent = makeEmail(EmailStatus.SENT, { sentAt: new Date() });

    mockFindUnique.mockResolvedValue(scheduled);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockResolvedValue({
      messageId: '<msg@ethereal>',
      previewUrl: 'https://ethereal.email/message/abc',
      accepted: ['test@example.com'],
      rejected: [],
    });
    mockUpdate.mockResolvedValue(sent);

    await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'email_1',
        status: { in: [EmailStatus.SCHEDULED, EmailStatus.FAILED] },
      },
      data: { status: EmailStatus.PROCESSING },
    });
  });

  it('4. Successful SMTP send changes status to SENT', async () => {
    const scheduled = makeEmail(EmailStatus.SCHEDULED);
    const sent = makeEmail(EmailStatus.SENT, { sentAt: new Date() });

    mockFindUnique.mockResolvedValue(scheduled);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockResolvedValue({
      messageId: '<msg@ethereal>',
      previewUrl: 'https://ethereal.email/message/abc',
      accepted: ['test@example.com'],
      rejected: [],
    });
    mockUpdate.mockResolvedValue(sent);

    const result = await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(result.outcome).toBe('sent');
    expect(mockSendEmail).toHaveBeenCalledWith({
      from: 'Demo <sender@reachinbox.local>',
      to: 'test@example.com',
      subject: 'Hello',
      body: 'Body',
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'email_1' },
        data: expect.objectContaining({
          status: EmailStatus.SENT,
          errorMessage: null,
        }),
      }),
    );
    expect(mockIndexEmailDocument).toHaveBeenCalledOnce();
  });

  it('5. SMTP failure changes status to FAILED', async () => {
    mockFindUnique.mockResolvedValue(makeEmail(EmailStatus.SCHEDULED));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockRejectedValue(new Error('SMTP connection refused'));
    mockUpdate.mockResolvedValue(
      makeEmail(EmailStatus.FAILED, {
        failedAt: new Date(),
        errorMessage: 'SMTP connection refused',
      }),
    );

    const result = await processScheduledEmail('email_1', { minSendDelayMs: 0 });

    expect(result.outcome).toBe('failed');
    if (result.outcome === 'failed') {
      expect(result.error).toBe('SMTP connection refused');
    }
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'email_1' },
        data: expect.objectContaining({
          status: EmailStatus.FAILED,
          errorMessage: 'SMTP connection refused',
        }),
      }),
    );
    expect(mockIndexEmailDocument).toHaveBeenCalledOnce();
  });

  it('6. Two processing attempts cannot both claim the same email (claim lost)', async () => {
    mockFindUnique.mockResolvedValue(makeEmail(EmailStatus.SCHEDULED));
    // Simulate first call winning atomic update (count 1), second call losing (count 0)
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    mockSendEmail.mockResolvedValue({
      messageId: '<msg@ethereal>',
      previewUrl: false,
      accepted: ['test@example.com'],
      rejected: [],
    });
    mockUpdate.mockResolvedValue(makeEmail(EmailStatus.SENT));

    const [res1, res2] = await Promise.all([
      processScheduledEmail('email_1', { minSendDelayMs: 0 }),
      processScheduledEmail('email_1', { minSendDelayMs: 0 }),
    ]);

    const outcomes = [res1.outcome, res2.outcome].sort();
    expect(outcomes).toEqual(['sent', 'skipped']);

    const skippedResult = [res1, res2].find((r) => r.outcome === 'skipped');
    if (skippedResult && skippedResult.outcome === 'skipped') {
      expect(skippedResult.reason).toBe('claim_lost');
    }

    // SMTP send should only happen once
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });
});
