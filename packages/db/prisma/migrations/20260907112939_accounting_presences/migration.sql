-- CreateTable
CREATE TABLE "accounting_presences" (
    "id" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "personId" TEXT NOT NULL,
    "markedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_presences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_presences_workDate_idx" ON "accounting_presences"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_presences_personId_workDate_key" ON "accounting_presences"("personId", "workDate");

-- AddForeignKey
ALTER TABLE "accounting_presences" ADD CONSTRAINT "accounting_presences_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_presences" ADD CONSTRAINT "accounting_presences_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
