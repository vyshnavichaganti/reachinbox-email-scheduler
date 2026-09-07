import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailStatus } from '@prisma/client';

const {
  mockFindUnique,
  mockUpdateMany,
  mockUpdate,
  mockSendEmail,
  mockAddDelayedEmailJob,
  mockIndexEmailDocument,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendEmail: vi.fn(),
  mockAddDelayedEmailJob: vi.fn(),
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

vi.mock('../src/lib/queue', () => ({
  QUEUE_NAMES: { EMAIL: 'emailQueue' },
  EMAIL_JOB_NAME: 'send-scheduled-email',
  addDelayedEmailJob: mockAddDelayedEmailJob,
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
    MIN_SEND_DELAY_MS: 2000,
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
import { RateLimiterService } from '../src/services/rateLimiter.service';

const sender1 = {
  id: 'sender_1',
  userId: 'user_1',
  email: 'sender1@reachinbox.local',
  displayName: 'Sender 1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sender2 = {
  id: 'sender_2',
  userId: 'user_1',
  email: 'sender2@reachinbox.local',
  displayName: 'Sender 2',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeEmail(id: string, status: EmailStatus, sender = sender1) {
  return {
    id,
    userId: 'user_1',
    senderId: sender.id,
    recipient: 'recipient@example.com',
    subject: 'Test Email',
    body: 'Test Body',
    scheduledAt: new Date(),
    status,
    bullJobId: id,
    idempotencyKey: `key-${id}`,
    sentAt: null,
    failedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender,
  };
}

describe('Stage 4 Distributed Rate Limiting & Rescheduling Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await RateLimiterService.resetRateLimitsForTests();
    mockIndexEmailDocument.mockResolvedValue(undefined);
    mockAddDelayedEmailJob.mockResolvedValue({ bullJobId: 'new-job', delay: 3600000 });
  });

  it('1. Allows email when capacity exists', async () => {
    mockFindUnique.mockResolvedValue(makeEmail('email_1', EmailStatus.SCHEDULED));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockResolvedValue({
      messageId: '<msg@ethereal>',
      previewUrl: false,
      accepted: ['recipient@example.com'],
      rejected: [],
    });
    mockUpdate.mockResolvedValue(makeEmail('email_1', EmailStatus.SENT));

    const result = await processScheduledEmail('email_1', {
      globalLimit: 10,
      senderLimit: 5,
      minSendDelayMs: 0,
    });

    expect(result.outcome).toBe('sent');
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('2. Rejects/reschedules when global hourly limit is reached', async () => {
    mockFindUnique.mockResolvedValue(makeEmail('email_global_limit', EmailStatus.SCHEDULED));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue(makeEmail('email_global_limit', EmailStatus.SCHEDULED));

    // Exhaust global limit = 1
    await RateLimiterService.reserveCapacity({
      senderId: 'sender_1',
      globalLimit: 1,
      senderLimit: 10,
    });

    const result = await processScheduledEmail('email_global_limit', {
      globalLimit: 1,
      senderLimit: 10,
      minSendDelayMs: 0,
    });

    expect(result.outcome).toBe('rescheduled');
    if (result.outcome === 'rescheduled') {
      expect(result.reason).toBe('global_limit_reached');
      expect(result.msUntilNextHour).toBeGreaterThan(0);
    }

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAddDelayedEmailJob).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'email_global_limit' },
        data: expect.objectContaining({
          status: EmailStatus.SCHEDULED,
        }),
      }),
    );
  });

  it('3. Enforces per-sender limit', async () => {
    mockFindUnique.mockResolvedValue(makeEmail('email_sender_limit', EmailStatus.SCHEDULED, sender1));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue(makeEmail('email_sender_limit', EmailStatus.SCHEDULED, sender1));

    // Exhaust sender1 limit = 1 (global limit = 10)
    await RateLimiterService.reserveCapacity({
      senderId: 'sender_1',
      globalLimit: 10,
      senderLimit: 1,
    });

    const result = await processScheduledEmail('email_sender_limit', {
      globalLimit: 10,
      senderLimit: 1,
      minSendDelayMs: 0,
    });

    expect(result.outcome).toBe('rescheduled');
    if (result.outcome === 'rescheduled') {
      expect(result.reason).toBe('sender_limit_reached');
    }
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('4. Multiple workers cannot exceed the limit (shared coordination)', async () => {
    mockFindUnique.mockImplementation((args: { where: { id: string } }) =>
      Promise.resolve(makeEmail(args.where.id, EmailStatus.SCHEDULED, sender1)),
    );
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockResolvedValue({
      messageId: '<msg@ethereal>',
      previewUrl: false,
      accepted: ['recipient@example.com'],
      rejected: [],
    });
    mockUpdate.mockResolvedValue(makeEmail('email', EmailStatus.SENT));

    // Run 5 concurrent processing attempts with globalLimit = 2
    const results = await Promise.all([
      processScheduledEmail('email_a', { globalLimit: 2, senderLimit: 5, minSendDelayMs: 0 }),
      processScheduledEmail('email_b', { globalLimit: 2, senderLimit: 5, minSendDelayMs: 0 }),
      processScheduledEmail('email_c', { globalLimit: 2, senderLimit: 5, minSendDelayMs: 0 }),
      processScheduledEmail('email_d', { globalLimit: 2, senderLimit: 5, minSendDelayMs: 0 }),
      processScheduledEmail('email_e', { globalLimit: 2, senderLimit: 5, minSendDelayMs: 0 }),
    ]);

    const sentCount = results.filter((r) => r.outcome === 'sent').length;
    const rescheduledCount = results.filter((r) => r.outcome === 'rescheduled').length;

    expect(sentCount).toBe(2);
    expect(rescheduledCount).toBe(3);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it('5. Both global and sender limits are enforced independently', async () => {
    // Sender 1 uses senderLimit (1)
    mockFindUnique.mockImplementation((args: { where: { id: string } }) => {
      const isSender1 = args.where.id.includes('s1');
      return Promise.resolve(makeEmail(args.where.id, EmailStatus.SCHEDULED, isSender1 ? sender1 : sender2));
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockResolvedValue({
      messageId: '<msg@ethereal>',
      previewUrl: false,
      accepted: ['recipient@example.com'],
      rejected: [],
    });
    mockUpdate.mockResolvedValue(makeEmail('email', EmailStatus.SENT));

    // Attempt 1: Sender 1 (uses 1 sender1 slot)
    const res1 = await processScheduledEmail('email_s1_1', { globalLimit: 10, senderLimit: 1, minSendDelayMs: 0 });
    // Attempt 2: Sender 1 (exceeds sender1 limit)
    const res2 = await processScheduledEmail('email_s1_2', { globalLimit: 10, senderLimit: 1, minSendDelayMs: 0 });
    // Attempt 3: Sender 2 (capacity exists under global 10 and sender2 limit 1)
    const res3 = await processScheduledEmail('email_s2_1', { globalLimit: 10, senderLimit: 1, minSendDelayMs: 0 });

    expect(res1.outcome).toBe('sent');
    expect(res2.outcome).toBe('rescheduled');
    expect(res3.outcome).toBe('sent');
  });

  it('6. Rate-limited jobs are rescheduled rather than marked FAILED', async () => {
    mockFindUnique.mockResolvedValue(makeEmail('email_resched', EmailStatus.SCHEDULED));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue(makeEmail('email_resched', EmailStatus.SCHEDULED));

    await RateLimiterService.reserveCapacity({ senderId: 'sender_1', globalLimit: 0, senderLimit: 0 });

    const result = await processScheduledEmail('email_resched', { globalLimit: 0, senderLimit: 0, minSendDelayMs: 0 });

    expect(result.outcome).toBe('rescheduled');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: EmailStatus.SCHEDULED }),
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: EmailStatus.FAILED }),
      }),
    );
  });

  it('7. Rate-limited jobs return rescheduled status without throwing for BullMQ retries', async () => {
    mockFindUnique.mockResolvedValue(makeEmail('email_no_error', EmailStatus.SCHEDULED));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue(makeEmail('email_no_error', EmailStatus.SCHEDULED));

    await RateLimiterService.reserveCapacity({ senderId: 'sender_1', globalLimit: 0, senderLimit: 0 });

    await expect(
      processScheduledEmail('email_no_error', { globalLimit: 0, senderLimit: 0, minSendDelayMs: 0 }),
    ).resolves.toEqual(
      expect.objectContaining({
        outcome: 'rescheduled',
      }),
    );
  });

  it('8. Minimum delay slot reservation calculates wait time', async () => {
    const delay1 = await RateLimiterService.reserveSendDelaySlot(100);
    const delay2 = await RateLimiterService.reserveSendDelaySlot(100);

    expect(delay1).toBe(0);
    expect(delay2).toBeGreaterThanOrEqual(90);
  });

  it('9. Concurrent workers receive strictly increasing send delay slots', async () => {
    const delays = await Promise.all([
      RateLimiterService.reserveSendDelaySlot(50),
      RateLimiterService.reserveSendDelaySlot(50),
      RateLimiterService.reserveSendDelaySlot(50),
    ]);

    expect(delays[0]).toBe(0);
    expect(delays[1]).toBeGreaterThanOrEqual(40);
    expect(delays[2]).toBeGreaterThanOrEqual(80);
  });

  it('10. SENT email is not processed again', async () => {
    mockFindUnique.mockResolvedValue(makeEmail('email_sent', EmailStatus.SENT));

    const result = await processScheduledEmail('email_sent');

    expect(result.outcome).toBe('skipped');
    if (result.outcome === 'skipped') {
      expect(result.reason).toBe('already_sent');
    }
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('11. CANCELLED email is not processed', async () => {
    mockFindUnique.mockResolvedValue(makeEmail('email_cancelled', EmailStatus.CANCELLED));

    const result = await processScheduledEmail('email_cancelled');

    expect(result.outcome).toBe('skipped');
    if (result.outcome === 'skipped') {
      expect(result.reason).toBe('cancelled');
    }
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
