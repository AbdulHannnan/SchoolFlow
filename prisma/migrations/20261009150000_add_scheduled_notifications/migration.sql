-- CreateTable
CREATE TABLE "scheduled_notifications" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "notification_type" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "channels" TEXT[],
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_notifications_schoolId_idx" ON "scheduled_notifications"("schoolId");

-- CreateIndex
CREATE INDEX "scheduled_notifications_sentAt_sendAt_idx" ON "scheduled_notifications"("sentAt", "sendAt");

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_schoolId_recipientId_fkey" FOREIGN KEY ("schoolId", "recipientId") REFERENCES "users"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "scheduled_notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "scheduled_notifications"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
