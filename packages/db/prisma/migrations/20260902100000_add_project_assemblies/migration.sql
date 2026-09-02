-- Assembly lists per project, and the link that records which assemblies a
-- timesheet covered. Progress is never stored on the assembly itself — it is
-- grouped from "timesheet_assemblies".

ALTER TABLE "activities" ADD COLUMN "tracksAssemblies" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "steel_profiles" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kgPerMeter" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steel_profiles_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "project_assemblies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "profile" TEXT,
    "profileKey" TEXT,
    "length" INTEGER,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,

    CONSTRAINT "project_assemblies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timesheet_assemblies" (
    "id" TEXT NOT NULL,
    "quantityDone" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesheetId" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "timesheet_assemblies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_assemblies_projectId_name_key" ON "project_assemblies"("projectId", "name");
CREATE INDEX "project_assemblies_projectId_deletedAt_position_idx" ON "project_assemblies"("projectId", "deletedAt", "position");
CREATE INDEX "project_assemblies_profileKey_idx" ON "project_assemblies"("profileKey");

CREATE UNIQUE INDEX "timesheet_assemblies_timesheetId_assemblyId_key" ON "timesheet_assemblies"("timesheetId", "assemblyId");
CREATE INDEX "timesheet_assemblies_assemblyId_activityId_idx" ON "timesheet_assemblies"("assemblyId", "activityId");

ALTER TABLE "project_assemblies" ADD CONSTRAINT "project_assemblies_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_assemblies" ADD CONSTRAINT "project_assemblies_profileKey_fkey"
    FOREIGN KEY ("profileKey") REFERENCES "steel_profiles"("key") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "timesheet_assemblies" ADD CONSTRAINT "timesheet_assemblies_timesheetId_fkey"
    FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timesheet_assemblies" ADD CONSTRAINT "timesheet_assemblies_assemblyId_fkey"
    FOREIGN KEY ("assemblyId") REFERENCES "project_assemblies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timesheet_assemblies" ADD CONSTRAINT "timesheet_assemblies_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
