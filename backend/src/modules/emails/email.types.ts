import type { Email, EmailStatus, Prisma } from '@prisma/client';

export type { EmailJobPayload } from '../../lib/queue';
export { EMAIL_JOB_NAME } from '../../lib/queue';

export type PaginationQuery = {
  page: number;
  limit: number;
  userId?: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedEmails = {
  data: Email[];
  pagination: PaginationMeta;
};

export type ScheduleEmailInput = {
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  idempotencyKey: string;
};

export type EmailListFilter = {
  statuses: EmailStatus[];
  orderBy: Prisma.EmailOrderByWithRelationInput;
};
