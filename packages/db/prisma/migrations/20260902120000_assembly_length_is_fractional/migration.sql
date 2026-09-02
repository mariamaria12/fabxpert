-- Lengths are not whole millimetres. Real drawing lists carry values like
-- 2981.6, which the spreadsheet only rounds for display — storing them as
-- integers loses the fraction without saying so.
ALTER TABLE "project_assemblies" ALTER COLUMN "length" TYPE DOUBLE PRECISION;
