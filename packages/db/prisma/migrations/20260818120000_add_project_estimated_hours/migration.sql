-- Estimated hours of work for the project. Nullable, left empty for existing rows.
ALTER TABLE "projects" ADD COLUMN "estimatedHours" DOUBLE PRECISION;
