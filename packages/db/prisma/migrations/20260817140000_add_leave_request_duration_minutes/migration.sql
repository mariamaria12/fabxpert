-- Partial-day RECUPERARE: hours off instead of whole days.
-- Null on every existing row, which keeps them whole-day requests.

ALTER TABLE "leave_requests" ADD COLUMN "durationMinutes" INTEGER;
