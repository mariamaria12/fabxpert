-- Per-column Panou order for two-column pinned project layout.
ALTER TABLE "projects" ADD COLUMN "panouColumn" INTEGER;

WITH sorted AS (
  SELECT
    id,
    "indexPanou" AS flat_index
  FROM "projects"
  WHERE "isPinned" = true
    AND "deletedAt" IS NULL
    AND "indexPanou" IS NOT NULL
)
UPDATE "projects" p
SET
  "panouColumn" = MOD(sorted.flat_index, 2),
  "indexPanou" = sorted.flat_index / 2
FROM sorted
WHERE p.id = sorted.id;

CREATE INDEX "projects_deletedAt_isPinned_panouColumn_indexPanou_idx"
  ON "projects"("deletedAt", "isPinned", "panouColumn", "indexPanou")
  WHERE "isPinned" = true;
