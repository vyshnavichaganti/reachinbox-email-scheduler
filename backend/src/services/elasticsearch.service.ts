import type { Email, EmailStatus, Sender } from '@prisma/client';
import { elasticsearch } from '../lib/elasticsearch';
import { logger } from '../lib/logger';

export const EMAIL_SEARCH_INDEX = 'emails';

export type EmailSearchDocument = {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SearchEmailsInput = {
  q?: string;
  status?: EmailStatus;
  senderId?: string;
  userId?: string;
  page?: number;
  limit?: number;
};

export type SearchEmailsResult = {
  data: EmailSearchDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class ElasticsearchService {
  /**
   * Safe initialization: creates the 'emails' index and mappings if it does not exist.
   * Leaves existing indices intact.
   */
  static async ensureIndex(): Promise<void> {
    try {
      const exists = await elasticsearch.indices.exists({ index: EMAIL_SEARCH_INDEX });
      if (exists) {
        return;
      }

      await elasticsearch.indices.create({
        index: EMAIL_SEARCH_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipient: { type: 'keyword' },
            subject: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            failedAt: { type: 'date' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      });

      logger.info('Elasticsearch email index created', { index: EMAIL_SEARCH_INDEX });
    } catch (err) {
      logger.warn('Failed to ensure Elasticsearch index (best-effort)', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Converts Prisma Email + Sender records to Elasticsearch document.
   */
  static toDocument(email: Email, _sender?: Pick<Sender, 'email'>): EmailSearchDocument {
    return {
      id: email.id,
      userId: email.userId,
      senderId: email.senderId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt.toISOString(),
      sentAt: email.sentAt?.toISOString() ?? null,
      failedAt: email.failedAt?.toISOString() ?? null,
      createdAt: email.createdAt.toISOString(),
      updatedAt: email.updatedAt.toISOString(),
    };
  }

  /**
   * Best-effort indexing: indexes or updates an email document in Elasticsearch.
   * If Elasticsearch is unavailable, logs the error without failing upstream business logic.
   */
  static async indexEmail(email: Email, sender?: Pick<Sender, 'email'>): Promise<void> {
    try {
      await this.ensureIndex();
      const document = this.toDocument(email, sender);

      await elasticsearch.index({
        index: EMAIL_SEARCH_INDEX,
        id: email.id,
        document,
        refresh: true,
      });

      logger.info('Email indexed in Elasticsearch', {
        emailId: email.id,
        status: email.status,
      });
    } catch (err) {
      logger.error('Best-effort Elasticsearch indexing failed', {
        emailId: email.id,
        status: email.status,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Searches email documents across recipient, subject, body with status/senderId filters & pagination.
   */
  static async searchEmails(input: SearchEmailsInput): Promise<SearchEmailsResult> {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.max(1, Math.min(100, input.limit ?? 20));

    const mustFilters: any[] = [];

    if (input.q && input.q.trim()) {
      mustFilters.push({
        multi_match: {
          query: input.q.trim(),
          fields: ['recipient^2', 'subject^2', 'body'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (input.status) {
      mustFilters.push({ term: { status: input.status } });
    }

    if (input.senderId) {
      mustFilters.push({ term: { senderId: input.senderId } });
    }

    if (input.userId) {
      mustFilters.push({ term: { userId: input.userId } });
    }

    const query =
      mustFilters.length > 0
        ? { bool: { must: mustFilters } }
        : { match_all: {} };

    try {
      const response = await elasticsearch.search<EmailSearchDocument>({
        index: EMAIL_SEARCH_INDEX,
        query,
        from: (page - 1) * limit,
        size: limit,
      });

      const hits = response.hits.hits;
      const data = hits.map((hit) => hit._source as EmailSearchDocument);
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (err) {
      logger.error('Elasticsearch search execution error', {
        message: err instanceof Error ? err.message : String(err),
      });
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }
}
