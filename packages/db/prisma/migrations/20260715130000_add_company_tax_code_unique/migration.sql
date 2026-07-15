-- Normalize empty tax codes before adding uniqueness.
UPDATE "companies"
SET "taxCode" = NULL
WHERE "taxCode" = '';

-- CreateIndex
CREATE UNIQUE INDEX "companies_taxCode_key" ON "companies"("taxCode");
