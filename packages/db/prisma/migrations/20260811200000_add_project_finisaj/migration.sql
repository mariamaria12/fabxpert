-- Free-text finish ("finisaj") for a project. Nullable, left empty for existing rows.
ALTER TABLE "projects" ADD COLUMN "finisaj" TEXT;
