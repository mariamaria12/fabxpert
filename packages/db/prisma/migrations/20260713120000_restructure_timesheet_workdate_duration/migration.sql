-- Restructure timesheet from (startTime, endTime) to (workDate, durationMinutes).
-- Existing timesheet rows are disposable pre-launch test data — wiped intentionally.

DELETE FROM "timesheets";

ALTER TABLE "timesheets" DROP COLUMN "startTime";
ALTER TABLE "timesheets" DROP COLUMN "endTime";

ALTER TABLE "timesheets" ADD COLUMN "workDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "timesheets" ADD COLUMN "durationMinutes" INTEGER NOT NULL;
