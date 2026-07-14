-- Performance indexes for list filters, summaries, and leave balance queries.

CREATE INDEX "timesheets_deletedAt_workDate_idx" ON "timesheets"("deletedAt", "workDate");
CREATE INDEX "timesheets_personId_idx" ON "timesheets"("personId");
CREATE INDEX "timesheets_projectId_idx" ON "timesheets"("projectId");

CREATE INDEX "projects_deletedAt_status_idx" ON "projects"("deletedAt", "status");

CREATE INDEX "leave_requests_deletedAt_status_startDate_endDate_idx" ON "leave_requests"("deletedAt", "status", "startDate", "endDate");
CREATE INDEX "leave_requests_personId_type_status_startDate_idx" ON "leave_requests"("personId", "type", "status", "startDate");
