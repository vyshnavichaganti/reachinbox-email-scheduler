-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "googleId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SCHEDULED',
    "bullJobId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "senders_userId_idx" ON "senders"("userId");

-- CreateIndex
CREATE INDEX "senders_email_idx" ON "senders"("email");

-- CreateIndex
CREATE UNIQUE INDEX "senders_userId_email_key" ON "senders"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "emails_idempotencyKey_key" ON "emails"("idempotencyKey");

-- CreateIndex
CREATE INDEX "emails_userId_idx" ON "emails"("userId");

-- CreateIndex
CREATE INDEX "emails_senderId_idx" ON "emails"("senderId");

-- CreateIndex
CREATE INDEX "emails_status_idx" ON "emails"("status");

-- CreateIndex
CREATE INDEX "emails_scheduledAt_idx" ON "emails"("scheduledAt");

-- CreateIndex
CREATE INDEX "emails_recipient_idx" ON "emails"("recipient");

-- CreateIndex
CREATE INDEX "emails_idempotencyKey_idx" ON "emails"("idempotencyKey");

-- CreateIndex
CREATE INDEX "emails_userId_status_idx" ON "emails"("userId", "status");

-- CreateIndex
CREATE INDEX "emails_status_scheduledAt_idx" ON "emails"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "senders" ADD CONSTRAINT "senders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "senders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
