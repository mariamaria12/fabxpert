-- Overtime: RECUPERARE leave type (time off in lieu) + monthly accrual snapshots.
-- The new enum value is only added here, never used in this migration, so it is
-- safe inside the migration transaction.

ALTER TYPE "LeaveType" ADD VALUE 'RECUPERARE';

CREATE TABLE "overtime_accruals" (
    "id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "earnedMinutes" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personId" TEXT NOT NULL,

    CONSTRAINT "overtime_accruals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "overtime_accruals_personId_month_key" ON "overtime_accruals"("personId", "month");
CREATE INDEX "overtime_accruals_personId_idx" ON "overtime_accruals"("personId");

ALTER TABLE "overtime_accruals" ADD CONSTRAINT "overtime_accruals_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
