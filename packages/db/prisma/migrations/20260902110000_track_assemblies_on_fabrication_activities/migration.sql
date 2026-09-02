-- Turn assembly tracking on for the activities that are done assembly by
-- assembly, so an existing database gets the feature on deploy instead of
-- waiting for someone to tick three boxes. Admin-editable afterwards; any
-- activity renamed away from these names is simply left alone.
UPDATE "activities"
SET "tracksAssemblies" = true
WHERE "name" IN ('Sudare', 'Asamblare', 'Vopsire')
  AND "deletedAt" IS NULL;
