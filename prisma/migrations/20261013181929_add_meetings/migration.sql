-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agenda" TEXT,
    "location" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_invitees" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_invitees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_schoolId_idx" ON "meetings"("schoolId");

-- CreateIndex
CREATE INDEX "meetings_schoolId_scheduledAt_idx" ON "meetings"("schoolId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_schoolId_id_key" ON "meetings"("schoolId", "id");

-- CreateIndex
CREATE INDEX "meeting_invitees_schoolId_idx" ON "meeting_invitees"("schoolId");

-- CreateIndex
CREATE INDEX "meeting_invitees_meetingId_idx" ON "meeting_invitees"("meetingId");

-- CreateIndex
CREATE INDEX "meeting_invitees_teacherId_idx" ON "meeting_invitees"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_invitees_meetingId_teacherId_key" ON "meeting_invitees"("meetingId", "teacherId");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_schoolId_meetingId_fkey" FOREIGN KEY ("schoolId", "meetingId") REFERENCES "meetings"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_schoolId_teacherId_fkey" FOREIGN KEY ("schoolId", "teacherId") REFERENCES "users"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "meetings"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "meeting_invitees" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "meeting_invitees"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
