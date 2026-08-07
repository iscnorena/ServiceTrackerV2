-- CreateTable
CREATE TABLE "guest_report_attempts" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_report_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_report_attempts_ipHash_createdAt_idx" ON "guest_report_attempts"("ipHash", "createdAt");
