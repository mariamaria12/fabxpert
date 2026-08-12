-- External employee flag. Additive: existing rows default to false.
ALTER TABLE "users" ADD COLUMN "angajatExtern" BOOLEAN NOT NULL DEFAULT false;
