-- Two figures typed in on the project form: parts per ton (the complexity
-- class, C1–C4) and linear meters of weld. Nullable, left empty for existing rows.
ALTER TABLE "projects" ADD COLUMN "piecesPerTon" DOUBLE PRECISION;
ALTER TABLE "projects" ADD COLUMN "weldLengthMeters" DOUBLE PRECISION;
