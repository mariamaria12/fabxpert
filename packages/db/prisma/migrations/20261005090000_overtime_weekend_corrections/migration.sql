-- Weekend hours of a month set by hand for one person: the row stands in for
-- the month's total in the "Ore sâmbătă" and "Ore duminică" columns.

-- CreateTable
CREATE TABLE "overtime_weekend_corrections" (
    "id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "saturdayMinutes" INTEGER,
    "sundayMinutes" INTEGER,
    "note" TEXT,
    "personId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_weekend_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "overtime_weekend_corrections_personId_month_key" ON "overtime_weekend_corrections"("personId", "month");

-- AddForeignKey
ALTER TABLE "overtime_weekend_corrections" ADD CONSTRAINT "overtime_weekend_corrections_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_weekend_corrections" ADD CONSTRAINT "overtime_weekend_corrections_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

