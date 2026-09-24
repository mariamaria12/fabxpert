-- Figures the project progress formula runs on, recomputed whenever a project
-- is delivered or taken back. The latest row is used.

-- CreateTable
CREATE TABLE "progress_calibrations" (
    "id" TEXT NOT NULL,
    "fixedWeightKg" DOUBLE PRECISION NOT NULL,
    "fixedWeightFromData" BOOLEAN NOT NULL,
    "activityWeights" JSONB NOT NULL,
    "activityWeightsFromData" BOOLEAN NOT NULL,
    "projectCount" INTEGER NOT NULL,
    "excludedProjectCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "progress_calibrations_createdAt_idx" ON "progress_calibrations"("createdAt");
