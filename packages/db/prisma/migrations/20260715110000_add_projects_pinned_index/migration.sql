-- Speed up pinned project summary (Panou) when only a small subset is pinned.
CREATE INDEX "projects_deletedAt_isPinned_idx" ON "projects"("deletedAt", "isPinned") WHERE "isPinned" = true;
