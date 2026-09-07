import { z } from 'zod';
import { EmailStatus } from '@prisma/client';

function parseIsoDate(value: string, ctx: z.RefinementCtx): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledAt must be a valid ISO-8601 datetime',
    });
    return z.NEVER;
  }
  return date;
}

export const scheduleEmailSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  senderId: z.string().min(1, 'senderId is required'),
  recipient: z
    .string()
    .trim()
    .email('recipient must be a valid email address')
    .max(320),
  subject: z.string().trim().min(1, 'subject is required').max(998),
  body: z.string().min(1, 'body is required').max(100_000),
  scheduledAt: z.string().min(1, 'scheduledAt is required').transform(parseIsoDate),
  idempotencyKey: z
    .string()
    .trim()
    .min(1, 'idempotencyKey is required')
    .max(128)
    .regex(/^[a-zA-Z0-9._:-]+$/, 'idempotencyKey contains invalid characters'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).optional(),
});

export const searchEmailsSchema = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(EmailStatus).optional(),
  senderId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const emailIdParamSchema = z.object({
  id: z.string().min(1, 'email id is required'),
});

export const bulkScheduleEmailSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  senderId: z.string().min(1, 'senderId is required'),
  recipients: z
    .array(z.string().trim().email('Invalid email recipient'))
    .min(1, 'At least one recipient is required')
    .max(500),
  subject: z.string().trim().min(1, 'subject is required').max(998),
  body: z.string().min(1, 'body is required').max(100_000),
  startTime: z.string().min(1, 'startTime is required').transform(parseIsoDate),
  delayBetweenMs: z.number().min(0).default(2000),
});

export type ScheduleEmailDto = z.infer<typeof scheduleEmailSchema>;
export type BulkScheduleEmailDto = z.infer<typeof bulkScheduleEmailSchema>;
export type PaginationDto = z.infer<typeof paginationSchema>;
export type SearchEmailsDto = z.infer<typeof searchEmailsSchema>;
