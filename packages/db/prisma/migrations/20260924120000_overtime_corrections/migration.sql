-- Overtime balances set by hand by an admin. The latest row per person replaces
-- everything before its effectiveDate.

-- CreateTable
CREATE TABLE "overtime_corrections" (
    "id" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "balanceMinutes" INTEGER NOT NULL,
    "previousBalanceMinutes" INTEGER NOT NULL,
    "note" TEXT,
    "personId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "overtime_corrections_personId_effectiveDate_idx" ON "overtime_corrections"("personId", "effectiveDate");

-- AddForeignKey
ALTER TABLE "overtime_corrections" ADD CONSTRAINT "overtime_corrections_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_corrections" ADD CONSTRAINT "overtime_corrections_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
