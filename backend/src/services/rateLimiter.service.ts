import { redis } from '../lib/redis';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export type ReserveCapacityInput = {
  senderId: string;
  globalLimit?: number;
  senderLimit?: number;
  now?: Date;
};

export type ReserveCapacityResult =
  | { allowed: true; globalCount: number; senderCount: number }
  | {
      allowed: false;
      reason: 'global_limit_reached' | 'sender_limit_reached';
      msUntilNextHour: number;
      globalCount: number;
      senderCount: number;
    };

/** Helper to format current UTC hour window string e.g. "2026-09-06T22" */
export function getHourWindowKey(date = new Date()): string {
  const iso = date.toISOString();
  return iso.substring(0, 13); // "YYYY-MM-DDTHH"
}

/** Calculate milliseconds remaining until the start of the next hour window */
export function getMsUntilNextHour(date = new Date()): number {
  const nextHour = new Date(date);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  return Math.max(1000, nextHour.getTime() - date.getTime());
}

// Lua script for atomic capacity reservation
const RESERVE_CAPACITY_LUA = `
local globalKey = KEYS[1]
local senderKey = KEYS[2]
local globalLimit = tonumber(ARGV[1])
local senderLimit = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])
local msUntilNextHour = tonumber(ARGV[4])

local globalCount = tonumber(redis.call('GET', globalKey) or '0')
local senderCount = tonumber(redis.call('GET', senderKey) or '0')

if globalCount >= globalLimit then
  return { 0, 1, msUntilNextHour, globalCount, senderCount }
end

if senderCount >= senderLimit then
  return { 0, 2, msUntilNextHour, globalCount, senderCount }
end

local newGlobal = redis.call('INCR', globalKey)
if newGlobal == 1 then
  redis.call('EXPIRE', globalKey, ttlSeconds)
end

local newSender = redis.call('INCR', senderKey)
if newSender == 1 then
  redis.call('EXPIRE', senderKey, ttlSeconds)
end

return { 1, 0, 0, newGlobal, newSender }
`;

// Lua script for atomic minimum send delay slot reservation
const RESERVE_SEND_DELAY_SLOT_LUA = `
local key = KEYS[1]
local minDelayMs = tonumber(ARGV[1])
local nowMs = tonumber(ARGV[2])

local lastTs = tonumber(redis.call('GET', key) or '0')
local targetTs = math.max(nowMs, lastTs + minDelayMs)

redis.call('SET', key, tostring(targetTs), 'EX', 120)

local waitMs = targetTs - nowMs
return waitMs
`;

// In-memory state for fallback/unit-testing when Redis is offline or unready
const mockGlobalCounts = new Map<string, number>();
const mockSenderCounts = new Map<string, number>();
let mockLastSendTs = 0;

export class RateLimiterService {
  /**
   * Atomically checks and reserves global & per-sender hourly limit capacity using Redis Lua script.
   */
  static async reserveCapacity(
    input: ReserveCapacityInput,
  ): Promise<ReserveCapacityResult> {
    const now = input.now ?? new Date();
    const hourWindow = getHourWindowKey(now);
    const globalKey = `email-rate:global:${hourWindow}`;
    const senderKey = `email-rate:sender:${input.senderId}:${hourWindow}`;

    const globalLimit = input.globalLimit ?? env.MAX_EMAILS_PER_HOUR;
    const senderLimit = input.senderLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const msUntilNextHour = getMsUntilNextHour(now);
    const ttlSeconds = Math.ceil(msUntilNextHour / 1000) + 3600;

    // Use live Redis if connected & ready; otherwise use fast atomic fallback state
    if (redis.status === 'ready') {
      try {
        const result = (await redis.eval(
          RESERVE_CAPACITY_LUA,
          2,
          globalKey,
          senderKey,
          globalLimit,
          senderLimit,
          ttlSeconds,
          msUntilNextHour,
        )) as [number, number, number, number, number];

        const [allowed, denialReasonCode, waitMs, globalCount, senderCount] = result;

        if (allowed === 1) {
          logger.info('Rate limit capacity reserved via Redis', {
            senderId: input.senderId,
            globalCount,
            globalLimit,
            senderCount,
            senderLimit,
            hourWindow,
          });
          return { allowed: true, globalCount, senderCount };
        }

        const reason =
          denialReasonCode === 1 ? 'global_limit_reached' : 'sender_limit_reached';

        logger.warn('Rate limit exceeded via Redis', {
          senderId: input.senderId,
          reason,
          globalCount,
          globalLimit,
          senderCount,
          senderLimit,
          msUntilNextHour: waitMs,
          hourWindow,
        });

        return {
          allowed: false,
          reason,
          msUntilNextHour: waitMs,
          globalCount,
          senderCount,
        };
      } catch (err) {
        logger.debug('Redis eval failed, falling back to local rate limiter state', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Atomic fallback state calculation
    const currentGlobal = mockGlobalCounts.get(globalKey) ?? 0;
    const currentSender = mockSenderCounts.get(senderKey) ?? 0;

    if (currentGlobal >= globalLimit) {
      return {
        allowed: false,
        reason: 'global_limit_reached',
        msUntilNextHour,
        globalCount: currentGlobal,
        senderCount: currentSender,
      };
    }

    if (currentSender >= senderLimit) {
      return {
        allowed: false,
        reason: 'sender_limit_reached',
        msUntilNextHour,
        globalCount: currentGlobal,
        senderCount: currentSender,
      };
    }

    const newGlobal = currentGlobal + 1;
    const newSender = currentSender + 1;
    mockGlobalCounts.set(globalKey, newGlobal);
    mockSenderCounts.set(senderKey, newSender);

    return { allowed: true, globalCount: newGlobal, senderCount: newSender };
  }

  /**
   * Atomically calculates and reserves global send timestamp slot to guarantee MIN_SEND_DELAY_MS
   * between individual email sends across parallel workers.
   */
  static async reserveSendDelaySlot(minDelayMs = env.MIN_SEND_DELAY_MS): Promise<number> {
    if (minDelayMs <= 0) {
      return 0;
    }

    const key = 'email-rate:last-send-timestamp';
    const nowMs = Date.now();

    if (redis.status === 'ready') {
      try {
        const waitMs = (await redis.eval(
          RESERVE_SEND_DELAY_SLOT_LUA,
          1,
          key,
          minDelayMs,
          nowMs,
        )) as number;

        if (waitMs > 0) {
          logger.info('Send delay slot reserved via Redis', { waitMs, minDelayMs });
        }

        return Math.max(0, Number(waitMs));
      } catch (err) {
        logger.debug('Redis delay slot eval failed, using fallback state', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const targetTs = Math.max(nowMs, mockLastSendTs + minDelayMs);
    mockLastSendTs = targetTs;
    const waitMs = Math.max(0, targetTs - nowMs);
    return waitMs;
  }

  /**
   * Test helper to reset internal fallback counters and clear Redis keys.
   */
  static async resetRateLimitsForTests(): Promise<void> {
    mockGlobalCounts.clear();
    mockSenderCounts.clear();
    mockLastSendTs = 0;
    if (redis.status === 'ready') {
      try {
        const keys = await redis.keys('email-rate:*');
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch {
        // ignore redis cleanup error in test fallback
      }
    }
  }
}
