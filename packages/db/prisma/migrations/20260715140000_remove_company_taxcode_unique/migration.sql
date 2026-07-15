-- Drop taxCode uniqueness: multiple client+site rows may share the same fiscal code.
DROP INDEX IF EXISTS "companies_taxCode_key";
