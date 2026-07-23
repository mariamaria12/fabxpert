-- Rename user visibility flag for clarity.
ALTER TABLE "users" RENAME COLUMN "seesOnlyAssignedProjects" TO "restrictedProjects";
