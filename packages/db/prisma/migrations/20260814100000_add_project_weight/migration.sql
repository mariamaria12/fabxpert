-- Project weight in kilograms. Nullable, left empty for existing rows.
ALTER TABLE "projects" ADD COLUMN "weight" DOUBLE PRECISION;
