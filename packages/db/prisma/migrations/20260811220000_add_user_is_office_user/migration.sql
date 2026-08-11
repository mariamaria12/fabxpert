-- Office accounts: shown under "Office" in admin, excluded from "nu au pontat".
ALTER TABLE "users" ADD COLUMN "isOfficeUser" BOOLEAN NOT NULL DEFAULT false;

-- Admins were already treated as office accounts everywhere; keep that true in data.
UPDATE "users" SET "isOfficeUser" = true WHERE "role" = 'ADMIN';
