-- Normalize empty tax codes (no unique index — multiple companies may share the same CUI).
UPDATE "companies"
SET "taxCode" = NULL
WHERE "taxCode" = '';
