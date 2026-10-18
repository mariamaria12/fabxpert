-- Activities that normally track assemblies but not on one project, e.g.
-- painting on a galvanised one. Only the exceptions are stored.

-- CreateTable
CREATE TABLE "project_untracked_activities" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "project_untracked_activities_pkey" PRIMARY KEY ("projectId","activityId")
);

-- AddForeignKey
ALTER TABLE "project_untracked_activities" ADD CONSTRAINT "project_untracked_activities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_untracked_activities" ADD CONSTRAINT "project_untracked_activities_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

