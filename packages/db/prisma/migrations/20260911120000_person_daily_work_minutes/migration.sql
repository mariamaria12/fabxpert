-- Per-person contractual working day. Null keeps the default 9h norm.
ALTER TABLE "persons" ADD COLUMN "dailyWorkMinutes" INTEGER;
