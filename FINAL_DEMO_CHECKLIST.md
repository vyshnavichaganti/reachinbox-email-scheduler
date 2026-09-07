# ReachInbox — Final 5-Minute Live Demo Checklist

This document provides the exact step-by-step sequence, startup commands, sample API payloads, expected outcomes, recommended reviewer screenshots, and architecture explanation required to conduct a live demonstration of the ReachInbox Email Scheduling Application.

---

## 1. Exact Startup Commands

Run the following commands across 5 separate terminal windows before starting the demo:

```bash
# Terminal 1: Infrastructure (PostgreSQL, Redis, Elasticsearch)
cd "d:/outbox labs"
docker compose up -d
docker compose ps

# Terminal 2: Database Migration & Seeding
cd "d:/outbox labs/backend"
npx prisma migrate deploy
npm run prisma:seed

# Terminal 3: Express Backend API Server (Port 4000)
cd "d:/outbox labs/backend"
npm run dev

# Terminal 4: Standalone Email Worker Process
cd "d:/outbox labs/backend"
npm run worker

# Terminal 5: Next.js Frontend Dashboard (Port 3000)
cd "d:/outbox labs/frontend"
npm run dev
```

---

## 2. API Demo Request & Expected Results

### Schedule Email Request (API Demo)
- **Endpoint**: `POST http://localhost:4000/api/emails/schedule`
- **Headers**: `Content-Type: application/json`
- **Payload**:
```json
{
  "userId": "cmtq3t1xu0000sa9lh6yfbohy",
  "senderId": "cmtq3t1yn0002sa9lcnce5opf",
  "recipient": "vyshnavireddychaganti12@gmail.com",
  "subject": "ReachInbox Live Demo Campaign",
  "body": "This is a live email job scheduled via BullMQ delayed queue.",
  "scheduledAt": "2026-09-06T18:15:00.000Z",
  "idempotencyKey": "demo-key-1001"
}
```

### Expected Response (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "cmtq4g69d0001d79ebwq9080w",
    "userId": "cmtq3t1xu0000sa9lh6yfbohy",
    "senderId": "cmtq3t1yn0002sa9lcnce5opf",
    "recipient": "vyshnavireddychaganti12@gmail.com",
    "subject": "ReachInbox Live Demo Campaign",
    "status": "SCHEDULED",
    "bullJobId": "cmtq4g69d0001d79ebwq9080w",
    "scheduledAt": "2026-09-06T18:15:00.000Z"
  }
}
```

---

## 3. Recommended Reviewer Screenshots to Capture

1. **Frontend Landing & Google Login Screen**: Showing ReachInbox branding, feature checkmarks, and Google Sign-in trigger.
2. **Dashboard Scheduled Queue Table**: Showing scheduled email records, status badges (`SCHEDULED`), refresh action, and pagination.
3. **Compose Email & CSV Upload Modal**: Showing subject, body, CSV drag-and-drop area with `"✓ 47 email addresses detected"`, start time, delay, and hourly limit inputs.
4. **BullMQ Live Queue Dashboard (`/admin/queues`)**: Showing `emailQueue` with live delayed, active, completed, and failed job counts.
5. **Sent & Delivered History Table**: Showing completed delivery logs with status badges (`SENT`), sent timestamps, and email detail inspection modal.
6. **Elasticsearch Search Results View**: Showing search input, status/sender filter dropdowns, and index search hits (`emails` index).
7. **Slack Workspace Integration View**: Showing Slack connected workspace status badge (`Connected to Acme Corp`).

---

## 4. 2-Minute Architecture Explanation for Reviewers

> "ReachInbox is an enterprise-ready full-stack email scheduling engine built with Node.js, Express, PostgreSQL, Prisma, BullMQ, Redis, Elasticsearch, and Next.js 14.
> 
> **Key Architecture Highlights**:
> 1. **Zero Cron**: No cron jobs, `node-cron`, or polling loops exist in the system. All scheduling and rate-limit rescheduling rely exclusively on BullMQ delayed jobs backed by Redis (`delay = max(0, scheduledAt - now)`).
> 2. **PostgreSQL as Primary Source of Truth**: Database transactions handle job persistence, status updates, and idempotency using `SELECT FOR UPDATE`.
> 3. **Restart Persistence**: If API servers or worker nodes shut down, scheduled jobs remain safely stored in PostgreSQL and BullMQ delayed Redis zsets. When worker processes restart, they pick up delayed jobs automatically.
> 4. **Distributed Hourly Rate Limiting & Spacing**: Global (`MAX_EMAILS_PER_HOUR`) and per-sender (`MAX_EMAILS_PER_HOUR_PER_SENDER`) limits are reserved atomically using Redis Lua scripts. Global spacing (`MIN_SEND_DELAY_MS`) is enforced across worker processes.
> 5. **Automatic Rescheduling**: Exceeded rate-limit jobs are rescheduled to the start of the next hourly window without consuming retries or setting `FAILED`.
> 6. **Slack Alerting & Elasticsearch Projection**: Dispatches rate-limit alerts to Slack with Redis hour window deduplication (`slack-notify:<senderId>:<hourWindow>`). Updates Elasticsearch documents as an eventual consistency search projection."

---

## 5. 5-Minute Live Demo Timeline

### `0:00 – 0:30` | Authentication & User Session
- Open `http://localhost:3000`. Show landing page, click **"Sign in with Google"**, observe session resolution via HTTP-only cookie (`reachinbox_session`), and highlight user profile header avatar & name.

### `0:30 – 1:15` | Dashboard Navigation & Queue Views
- Navigate between tabs: **Scheduled Emails**, **Sent Emails**, **Search**, and **Slack / Integrations**. Open Email Details Modal to inspect body text and job metadata.

### `1:15 – 2:00` | Compose & CSV Bulk Email Campaign
- Click **"Compose New Email"**. Select Sender, enter Subject/Body, drag-and-drop CSV file (`"✓ 47 email addresses detected"`), set delay & hourly limit, click **"Schedule Emails"**, and observe success toast banner.

### `2:00 – 2:30` | BullMQ Admin Dashboard (@bull-board)
- Open `http://localhost:4000/admin/queues`. View `@bull-board` interface showing `emailQueue` live job counts (delayed, active, completed).

### `2:30 – 3:15` | Worker Execution & Ethereal SMTP Delivery
- Observe worker logs in Terminal 4 processing delayed jobs, executing Nodemailer Ethereal SMTP send, updating DB status to `SENT`, and indexing Elasticsearch.

### `3:15 – 3:45` | Elasticsearch Full-Text Search
- Switch to **Search** tab. Search across recipient, subject, and body content with status/sender filters. Show hit counts and paginated results.

### `3:45 – 4:30` | Server Restart & Job Persistence
- Schedule email 2 minutes in future. Stop API server and worker terminals (keep Docker running). Verify job remains `SCHEDULED` in DB and delayed zset in Redis. Restart API server and worker. Observe job executed cleanly once scheduled time arrives.

### `4:30 – 5:00` | Rate Limiting & Slack Notification
- Exceed hourly rate limit. Show excess jobs rescheduled to next hour window, Redis deduplicated Slack alert dispatched, and Slack disconnect action.
