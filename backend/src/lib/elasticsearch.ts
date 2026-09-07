import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from './logger';

const globalForEs = globalThis as unknown as { es?: Client };

export const elasticsearch =
  globalForEs.es ??
  new Client({
    node: env.ELASTICSEARCH_NODE,
  });

if (env.NODE_ENV !== 'production') {
  globalForEs.es = elasticsearch;
}

export async function pingElasticsearch(): Promise<boolean> {
  const result = await elasticsearch.ping();
  return result === true;
}

export async function connectElasticsearch(): Promise<void> {
  const ok = await pingElasticsearch();
  if (!ok) {
    throw new Error('Elasticsearch ping failed');
  }
  logger.info('Elasticsearch connected', { node: env.ELASTICSEARCH_NODE });
}
