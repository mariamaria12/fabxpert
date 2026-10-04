-- Weekend hours leave the overtime balance: Saturdays, public holidays and
-- Sundays are counted as logged, in columns of their own. Months approved
-- before this keep the old reading, so every existing row is marked false.

-- AlterTable
ALTER TABLE "overtime_settlements" ADD COLUMN "weekendApart" BOOLEAN NOT NULL DEFAULT false;
