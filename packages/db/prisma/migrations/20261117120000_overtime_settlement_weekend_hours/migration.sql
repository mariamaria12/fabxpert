-- The monthly approval now covers weekend hours too: what was approved is kept
-- on the settlement, so a later change can be told apart. Rows approved before
-- this stay null and are not compared.

-- AlterTable
ALTER TABLE "overtime_settlements" ADD COLUMN "saturdayMinutes" INTEGER;
ALTER TABLE "overtime_settlements" ADD COLUMN "sundayMinutes" INTEGER;
