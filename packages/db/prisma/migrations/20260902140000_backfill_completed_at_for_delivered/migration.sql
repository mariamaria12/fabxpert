-- The Rapoarte analytics now cover delivered projects as well as closed ones,
-- and a project belongs to an interval through its "completedAt". LIVRAT
-- projects were never stamped, so they would all sit outside every interval.
--
-- Same one-time approximation the FINALIZAT backfill used: the last update
-- time. New deliveries get an exact timestamp from the app going forward.
UPDATE "projects"
  SET "completedAt" = "updatedAt"
  WHERE "status" = 'LIVRAT' AND "completedAt" IS NULL AND "deletedAt" IS NULL;
