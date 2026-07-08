-- =============================================================================
-- FabXpert PROD — seed inițial (Supabase SQL Editor → paste → Run)
-- Presupune: migrările Prisma sunt deja aplicate, tabelele sunt goale.
--
-- Conturi create:
--   admin@metalxpert.ro    / ChangeMe123!  → rol ADMIN
--   employee@metalxpert.ro / ChangeMe123!  → rol EMPLOYEE
--
-- Ordine: lookup (roluri job + activități) → Person → User (login)
-- =============================================================================

BEGIN;

-- 1) Roluri angajați (lookup)
INSERT INTO "employee_roles" ("id", "name", "isActive", "createdAt", "updatedAt") VALUES
  ('10000000-0000-0000-0000-000000000001', 'Sudor', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'Vopsitor', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'Șofer', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000004', 'Lăcătuș mecanic', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000005', 'Muncitor necalificat', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000006', 'Administrativ', true, NOW(), NOW());

-- 2) Activități (lookup)
INSERT INTO "activities" ("id", "name", "color", "isActive", "createdAt", "updatedAt") VALUES
  ('20000000-0000-0000-0000-000000000001', 'Debitare (inclusiv CNC intern)', '#3B7EA1', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', 'Asamblare', '#7A8450', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', 'Sudare', '#B5533C', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', 'Vopsire', '#8E5FA8', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000005', 'Rectificare', '#6B6B6B', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000006', 'Premontaj/Montaj', '#C9A227', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000007', 'Administrativ', '#8A8A8A', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000008', 'CNC extern', '#2F6F4E', true, NOW(), NOW());

-- 3) Persoane (profil — fără parolă)
INSERT INTO "persons" ("id", "firstName", "lastName", "email", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin', 'MetalXpert', 'admin@metalxpert.ro', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Employee', 'MetalXpert', 'employee@metalxpert.ro', NOW(), NOW());

-- 4) Conturi login (User → Person)
-- Parolă: ChangeMe123!  (bcrypt cost 12, compatibil cu API)
INSERT INTO "users" ("id", "email", "passwordHash", "role", "isActive", "createdAt", "updatedAt", "personId") VALUES
  (
    '00000000-0000-0000-0000-000000000011',
    'admin@metalxpert.ro',
    '$2a$12$Ztay3BkdXcNTQaw0Agzjreu6xkEf26L5wtUkVCBonm8jq9nus2f1.',
    'ADMIN',
    true,
    NOW(),
    NOW(),
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'employee@metalxpert.ro',
    '$2a$12$Ztay3BkdXcNTQaw0Agzjreu6xkEf26L5wtUkVCBonm8jq9nus2f1.',
    'EMPLOYEE',
    true,
    NOW(),
    NOW(),
    '00000000-0000-0000-0000-000000000002'
  );

COMMIT;

-- Verificare (rulează separat după seed):
-- SELECT u.email, u.role, p."firstName", p."lastName"
-- FROM "users" u
-- JOIN "persons" p ON p.id = u."personId";
