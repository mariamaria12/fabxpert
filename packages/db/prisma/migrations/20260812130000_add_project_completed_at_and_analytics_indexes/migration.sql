-- Completion timestamp for projects. The app sets it when a project enters
-- FINALIZAT and clears it if the project leaves that status. It drives the
-- Rapoarte productivity analytics: a project belongs to an interval when its
-- `completedAt` falls inside it.
ALTER TABLE "projects" ADD COLUMN "completedAt" TIMESTAMP(3);

-- One-time backfill: projects already FINALIZAT have no recorded completion
-- date, so approximate it with the last update time. New completions get an
-- exact timestamp from the app going forward.
UPDATE "projects"
  SET "completedAt" = "updatedAt"
  WHERE "status" = 'FINALIZAT' AND "completedAt" IS NULL;

-- Analytics indexes.
-- projects: fetch FINALIZAT projects by completion date range.
CREATE INDEX "projects_status_completedAt_idx" ON "projects"("status", "completedAt");
-- timesheets: hours grouped by activity.
CREATE INDEX "timesheets_activityId_idx" ON "timesheets"("activityId");
