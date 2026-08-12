-- Free-text admin notes on a project. Nullable, empty for existing rows.
ALTER TABLE "projects" ADD COLUMN "notes" TEXT;
