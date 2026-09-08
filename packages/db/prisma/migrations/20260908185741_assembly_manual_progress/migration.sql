-- CreateTable
CREATE TABLE "assembly_manual_progress" (
    "id" TEXT NOT NULL,
    "quantityDone" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "markedById" TEXT NOT NULL,

    CONSTRAINT "assembly_manual_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assembly_manual_progress_assemblyId_activityId_key" ON "assembly_manual_progress"("assemblyId", "activityId");

-- AddForeignKey
ALTER TABLE "assembly_manual_progress" ADD CONSTRAINT "assembly_manual_progress_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "project_assemblies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_manual_progress" ADD CONSTRAINT "assembly_manual_progress_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_manual_progress" ADD CONSTRAINT "assembly_manual_progress_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
