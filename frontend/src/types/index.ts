export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Email {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  bullJobId?: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

export interface SearchResult {
  data: Email[];
  pagination: Pagination;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
}

export interface ScheduleBulkInput {
  userId: string;
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenMs: number;
}

export type { ParseResult } from '../utils/csv';
