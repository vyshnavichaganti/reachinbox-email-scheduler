import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env';

const { mockWorkerConstructor, mockWorkerOn } = vi.hoisted(() => ({
  mockWorkerConstructor: vi.fn(),
  mockWorkerOn: vi.fn(),
}));

vi.mock('bullmq', () => {
  return {
    Worker: class {
      constructor(name: string, processor: unknown, opts: unknown) {
        mockWorkerConstructor(name, processor, opts);
      }
      on(event: string, cb: unknown) {
        mockWorkerOn(event, cb);
      }
      close() {
        return Promise.resolve();
      }
    },
  };
});

vi.mock('../src/lib/emailSearch', () => ({
  ensureEmailIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { startEmailWorker, stopEmailWorker } from '../src/workers/email.worker';

describe('7. Worker concurrency & configuration tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await stopEmailWorker();
  });

  it('respects configurable WORKER_CONCURRENCY from env by default', async () => {
    await startEmailWorker();

    expect(mockWorkerConstructor).toHaveBeenCalledOnce();
    const [, , opts] = mockWorkerConstructor.mock.calls[0];

    expect((opts as { concurrency: number }).concurrency).toBe(env.WORKER_CONCURRENCY);
  });

  it('allows overriding concurrency explicitly when starting worker', async () => {
    await startEmailWorker(10);

    expect(mockWorkerConstructor).toHaveBeenCalledOnce();
    const [, , opts] = mockWorkerConstructor.mock.calls[0];

    expect((opts as { concurrency: number }).concurrency).toBe(10);
  });
});
