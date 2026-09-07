# ReachInbox Backend API & Worker Engine

Express + TypeScript API engine with Prisma ORM, BullMQ delayed jobs, Ethereal SMTP delivery, distributed Redis rate limiting, Elasticsearch search, Bull Board live dashboard, Google OAuth 2.0, and Slack OAuth 2.0 integration.

---

## Architecture Diagram

```text
+-------------------------------------------------------------------------------+
|                            EXPRESS API SERVER (4000)                          |
|  /api/auth  |  /api/emails  |  /api/emails/bulk-schedule  |  /admin/queues   |
+-------------------+-------------------+-------------------+-------------------+
                    |                   |                   |
                    v                   v                   v
            +---------------+   +---------------+   +---------------+
            |  PostgreSQL   |   |     Redis     |   | Elasticsearch |
            |  (Primary DB) |   | (BullMQ Queue)|   | (Search Index)|
            +---------------+   +-------+-------+   +---------------+
                                        | Delayed Jobs
                                        v
+-------------------------------------------------------------------------------+
|                             EMAIL WORKER NODE                                 |
|  1. Claim DB Job (SELECT FOR UPDATE)   4. Send via Ethereal SMTP             |
|  2. Reserve Spacing (Redis Lua)        5. Update Status SENT / FAILED         |
|  3. Reserve Rate Limit (Redis Lua)     6. Index Elasticsearch / Slack Alert   |
+-------------------------------------------------------------------------------+
```

---

## Quick Start Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run Express API (hot reload via `tsx watch`) |
| `npm run worker` | Run standalone email worker (`tsx src/worker.ts`) |
| `npm run dev:worker` | Run standalone email worker with file watcher |
| `npm run start:worker` | Run compiled standalone email worker (`node dist/worker.js`) |
| `npm run build` | Compile TypeScript (`tsc`) |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run Vitest unit & integration test suite (49 tests) |
| `npx prisma migrate deploy` | Apply Prisma database migrations |
| `npm run prisma:seed` | Seed demo user + sender records |

---

## Core Operational Guarantees

- **NO CRON IS USED.** All job execution uses BullMQ delayed jobs backed by Redis: `delay = max(0, scheduledAt - now)`.
- **Restart Persistence**: Scheduled emails stored in PostgreSQL and BullMQ delayed Redis keys remain intact when server or worker processes restart.
- **Idempotency**: Workers use database transactions with `SELECT FOR UPDATE` and status verification. Jobs already `SENT` or `CANCELLED` are skipped safely.
- **Worker Concurrency**: Configurable parallel job processing per worker node (`WORKER_CONCURRENCY`).
- **Minimum Send Delay Spacing**: `MIN_SEND_DELAY_MS` spacing enforced across worker nodes using atomic Redis Lua scripts (`reserveSendDelaySlot`).
- **Distributed Hourly Rate Limiting**: Global (`MAX_EMAILS_PER_HOUR`) and per-sender (`MAX_EMAILS_PER_HOUR_PER_SENDER`) limits checked atomically using Redis Lua script.
- **Automatic Rescheduling**: Exceeded rate-limit jobs are rescheduled to the next hourly window without consuming BullMQ retries.
- **Slack Alerting**: Rate-limit alerts dispatched to connected Slack workspace using Redis hourly window deduplication (`slack-notify:<senderId>:<hourWindow>`). Fault tolerant.
- **Elasticsearch Search**: Best-effort search projection (`emails` index) for full-text recipient, subject, and body querying.
- **Bull Board Dashboard**: Mounted at `/admin/queues` via `@bull-board/express` adapter.
