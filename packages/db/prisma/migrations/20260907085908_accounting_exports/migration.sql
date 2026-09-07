-- DropIndex
DROP INDEX "notifications_pollId_idx";

-- CreateTable
CREATE TABLE "accounting_exports" (
    "id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedByUserId" TEXT,

    CONSTRAINT "accounting_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_exports_month_key" ON "accounting_exports"("month");

-- AddForeignKey
ALTER TABLE "accounting_exports" ADD CONSTRAINT "accounting_exports_exportedByUserId_fkey" FOREIGN KEY ("exportedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
