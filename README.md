# ReachInbox — Full-Stack Email Scheduling Application

Production-quality full-stack email job scheduler assignment for **Outbox Labs / ReachInbox**.

> **Status:** Stage 8 — Live Integration Verification & Documentation Complete.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Frontend["Next.js 14 Frontend (Port 3000)"]
        UI["Dashboard UI (React 18 + Tailwind CSS)"]
        CSV["Client-Side CSV/TXT Email Parser"]
        APIClient["API Client (credentials: 'include')"]
    end

    subgraph Backend["Express + TypeScript API (Port 4000)"]
        AuthRouter["Auth Router (/api/auth)"]
        EmailRouter["Email Router (/api/emails)"]
        SlackRouter["Slack Router (/api/slack)"]
        SenderRouter["Sender Router (/api/senders)"]
        BullBoard["Bull Board UI (/admin/queues)"]
    end

    subgraph Workers["BullMQ Worker Process"]
        Worker["Email Processor (Worker Concurrency)"]
        RateLimiter["Rate Limiter & Spacing (Redis Lua)"]
    end

    subgraph Services["Databases & Infrastructure"]
        Postgres[(PostgreSQL - Primary DB)]
        Redis[(Redis - BullMQ & Rate Limit Keys)]
        Elastic[(Elasticsearch - Search Projection)]
        SMTP[Ethereal SMTP / Nodemailer]
        SlackAPI[Slack Web API]
    end

    UI --> APIClient
    CSV --> UI
    APIClient --> AuthRouter
    APIClient --> EmailRouter
    APIClient --> SlackRouter
    APIClient --> SenderRouter

    EmailRouter --> Postgres
    EmailRouter --> Redis
    EmailRouter --> Elastic

    Worker --> Redis
    Worker --> RateLimiter
    Worker --> Postgres
    Worker --> SMTP
    Worker --> Elastic
    Worker --> SlackAPI
```

### System Component Schematic (ASCII)

```text
+-------------------------------------------------------------------------------+
|                             NEXT.JS FRONTEND (3000)                           |
|  [Google Login]  [Scheduled Queue]  [Sent History]  [Search]  [CSV Upload]    |
+---------------------------------------+---------------------------------------+
                                        | HTTP / JSON + Cookie
                                        v
+-------------------------------------------------------------------------------+
|                           EXPRESS API SERVER (4000)                           |
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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend API | Node.js (v20+), TypeScript, Express.js |
| Queue Engine | BullMQ + Redis (**Delayed Jobs Only — Zero Cron**) |
| Queue Dashboard | `@bull-board/express` (`http://localhost:4000/admin/queues`) |
| Primary Database | PostgreSQL + Prisma ORM |
| Search Engine | Elasticsearch (`emails` index) |
| SMTP Transport | Ethereal Email (Nodemailer) |
| Frontend App | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Session Auth | Google OAuth 2.0 + Signed JWT (`reachinbox_session` HTTP-Only Cookie) |
| Alerting | Slack OAuth 2.0 + Redis Window Deduplicated Notifications |
| Infrastructure | Docker Compose (PostgreSQL, Redis, Elasticsearch) |

**IMPORTANT: NO CRON IS USED.**  
Scheduling and rate-limit rescheduling rely exclusively on BullMQ delayed jobs backed by Redis (`delay = max(0, scheduledAt - now)`).

---

## Key Architectural Principles

1. **PostgreSQL is Source of Truth**: Database transactions handle job persistence, status updates, and idempotency. Queue jobs and Elasticsearch indexes are projections.
2. **Persistence Across Restart**: If backend/worker nodes are stopped or restarted, scheduled emails remain safely stored in PostgreSQL and BullMQ delayed Redis keys. When nodes restart, workers resume processing automatically without missing jobs.
3. **Idempotent Delivery**: Worker claims jobs using `SELECT FOR UPDATE` and status verification. Jobs already `SENT` or `CANCELLED` are skipped immediately, guaranteeing zero duplicate sends.
4. **Configurable Worker Concurrency**: Processes `WORKER_CONCURRENCY` jobs in parallel per worker process.
5. **Global Send Spacing (`MIN_SEND_DELAY_MS`)**: Enforced via atomic Redis Lua script (`reserveSendDelaySlot`) to ensure uniform delay between SMTP sends regardless of worker count.
6. **Distributed Hourly Rate Limiting**: Global (`MAX_EMAILS_PER_HOUR`) and per-sender (`MAX_EMAILS_PER_HOUR_PER_SENDER`) limits enforced via atomic Redis Lua script.
7. **Rate-Limit Rescheduling**: Excess emails exceeding hourly limits are automatically rescheduled to the start of the next hour window without consuming BullMQ retries or failing jobs.
8. **Slack Rate-Limit Notifications**: Dispatches rate-limit alerts to connected Slack workspaces using Redis hourly window deduplication (`slack-notify:<senderId>:<hourWindow>`). Fault tolerant — Slack API failure never crashes email queue execution.

---

## Setup & Running Instructions

### 1. Prerequisites
- Node.js >= 20.x
- Docker & Docker Compose (or standalone PostgreSQL, Redis, Elasticsearch daemons)

### 2. Infrastructure Setup
```bash
# Clone repository and navigate to root
cd "d:/outbox labs"

# Start infrastructure services (PostgreSQL, Redis, Elasticsearch)
docker compose up -d

# Verify container status
docker compose ps
```

### 3. Backend Setup & Migrations
```bash
cd backend

# Install dependencies
npm install

# Run Prisma database migrations
npx prisma migrate deploy

# Seed demo user & sender records
npm run prisma:seed
```

### 4. Running Application Services

```bash
# Terminal 1: Express Backend API (Port 4000)
cd backend
npm run dev

# Terminal 2: Standalone Email Worker Process
cd backend
npm run worker

# Terminal 3: Next.js Frontend Dashboard (Port 3000)
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Environment Configuration

Create a `.env` file in `backend/`:

```env
# Server Configuration
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# Database & Cache Connections
DATABASE_URL=postgresql://reachinbox:reachinbox123@localhost:5432/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Search Engine
ELASTICSEARCH_NODE=http://localhost:9200

# Session & JWT Secrets
SESSION_SECRET=reachinbox_super_secret_session_key_32_chars
JWT_SECRET=reachinbox_jwt_signing_key_32_chars_long

# Worker & Rate Limiting Configuration
WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=100

# OAuth Credentials (Google & Slack)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback

# Bull Board Dashboard Controls
QUEUE_DASHBOARD_ENABLED=true
QUEUE_DASHBOARD_USER=admin
QUEUE_DASHBOARD_PASS=adminsecret
```

---

## API Endpoints Reference

### Authentication (`/api/auth`)
- `GET /api/auth/google`: Redirects to Google OAuth authorization page.
- `GET /api/auth/google/callback`: OAuth callback handler; sets `reachinbox_session` HTTP-only cookie.
- `GET /api/auth/me`: Returns current user profile (401 if unauthenticated).
- `POST /api/auth/logout`: Clears session cookie.

### Email Operations (`/api/emails`)
- `POST /api/emails/schedule`: Schedule a single email delayed job.
- `POST /api/emails/bulk-schedule`: Schedule a batch campaign of emails with staggered delays.
- `GET /api/emails/scheduled`: Paginated list of scheduled emails for the user.
- `GET /api/emails/sent`: Paginated list of sent & failed emails.
- `GET /api/emails/search`: Elasticsearch query search (`q`, `status`, `senderId`, `page`, `limit`).
- `GET /api/emails/:id`: Retrieve single email details.
- `DELETE /api/emails/:id`: Cancel a scheduled email.

### Sender Management (`/api/senders`)
- `GET /api/senders`: List available senders for current user.

### Slack Integration (`/api/slack`)
- `GET /api/slack/connect`: Redirects to Slack OAuth page.
- `GET /api/slack/callback`: Stores `SlackConnection` per user.
- `GET /api/slack/status`: Returns connection status (access tokens omitted).
- `DELETE /api/slack/disconnect`: Disconnects Slack workspace.

### Health & Monitoring
- `GET /api/health`: Health status for Postgres, Redis, BullMQ, and Elasticsearch.
- `GET /admin/queues`: Bull Board live dashboard interface.

---

## Testing & Verification

### Automated Test Suite Execution

```bash
# Run backend vitest suite (49 unit/integration tests)
cd backend
npm test

# Run backend TypeScript typecheck
npm run typecheck

# Run backend production build
npm run build

# Run frontend Next.js production build
cd ../frontend
npm run build
```

---

## Known Limitations & Assumptions

1. **Third-Party OAuth Credentials**: Live Google OAuth and Slack OAuth flows require registered App Credentials in `.env` (`GOOGLE_CLIENT_ID`, `SLACK_CLIENT_ID`, etc.). When running in offline or demo environments without live credentials, deterministic test fallbacks allow local user creation and mock Slack connections.
2. **SMTP Provider**: Email delivery uses Nodemailer's Ethereal SMTP sandbox for safe testing without dispatching real inbox emails. Production environments can swap SMTP host/port credentials in `.env` seamlessly.
3. **Queue Architecture**: No cron, `node-cron`, or interval polling is used anywhere in the codebase. All delayed jobs and rescheduling use Redis-backed BullMQ delayed keys.

---

## License

Private — Outbox Labs hiring assignment.
