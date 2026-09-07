-- A project with an assembly list weighs what the list weighs: pieces times
-- kilograms per piece, over the lines that carry a weight. From here on the
-- API rewrites this on every list change; this brings existing projects in line.
UPDATE "projects" p
SET "weight" = totals."weightKg"
FROM (
  SELECT
    pa."projectId",
    SUM(pa.quantity * pa."weightPerPiece")::float AS "weightKg"
  FROM "project_assemblies" pa
  WHERE pa."deletedAt" IS NULL
    AND pa."weightPerPiece" IS NOT NULL
  GROUP BY pa."projectId"
) totals
WHERE p.id = totals."projectId";
