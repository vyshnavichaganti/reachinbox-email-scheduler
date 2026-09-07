import type { Email, Sender } from '@prisma/client';
import {
  ElasticsearchService,
  EMAIL_SEARCH_INDEX,
  type EmailSearchDocument,
} from '../services/elasticsearch.service';

export { EMAIL_SEARCH_INDEX };
export type { EmailSearchDocument };

export async function ensureEmailIndex(): Promise<void> {
  return ElasticsearchService.ensureIndex();
}

export function toEmailSearchDocument(
  email: Email,
  sender?: Pick<Sender, 'email'>,
): EmailSearchDocument {
  return ElasticsearchService.toDocument(email, sender);
}

export async function indexEmailDocument(
  email: Email,
  sender?: Pick<Sender, 'email'>,
): Promise<void> {
  return ElasticsearchService.indexEmail(email, sender);
}
