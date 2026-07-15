-- Panou display order for pinned projects (drag-and-drop reorder).
ALTER TABLE "projects" ADD COLUMN "indexPanou" INTEGER;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY name ASC) - 1 AS idx
  FROM "projects"
  WHERE "isPinned" = true
    AND "deletedAt" IS NULL
)
UPDATE "projects" p
SET "indexPanou" = ordered.idx
FROM ordered
WHERE p.id = ordered.id;

CREATE INDEX "projects_deletedAt_isPinned_indexPanou_idx"
  ON "projects"("deletedAt", "isPinned", "indexPanou")
  WHERE "isPinned" = true;
