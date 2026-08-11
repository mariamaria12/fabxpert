-- Free-text "denumire lucrare" for a project. Nullable, left empty for existing rows.
ALTER TABLE "projects" ADD COLUMN "denumire_lucrare" TEXT;
