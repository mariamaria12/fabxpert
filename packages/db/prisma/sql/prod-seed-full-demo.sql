-- =============================================================================
-- FabXpert PROD — seed demo complet (Supabase SQL Editor → paste → Run)
-- Presupune: migrările Prisma sunt aplicate.
--
-- Populează TOATE tabelele cu câte 5 înregistrări.
-- Idempotent: ON CONFLICT DO NOTHING (poate fi rulat de mai multe ori).
--
-- Conturi login (parolă pentru toate: ChangeMe123!):
--   admin@metalxpert.ro     → ADMIN   (web)
--   employee@metalxpert.ro  → EMPLOYEE (mobile)
--   ion.popescu@metalxpert.ro, vasile.ionescu@metalxpert.ro, andrei.marin@metalxpert.ro → EMPLOYEE
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) employee_roles (5)
-- ---------------------------------------------------------------------------
INSERT INTO "employee_roles" ("id", "name", "isActive", "createdAt", "updatedAt") VALUES
  ('10000000-0000-0000-0000-000000000001', 'Sudor', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'Vopsitor', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'Șofer', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000004', 'Lăcătuș mecanic', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000005', 'Administrativ', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) activities (5)
-- ---------------------------------------------------------------------------
INSERT INTO "activities" ("id", "name", "color", "isActive", "createdAt", "updatedAt") VALUES
  ('20000000-0000-0000-0000-000000000001', 'Debitare (inclusiv CNC intern)', '#3B7EA1', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', 'Asamblare', '#7A8450', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', 'Sudare', '#B5533C', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', 'Vopsire', '#8E5FA8', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000005', 'Rectificare', '#6B6B6B', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) companies (5) — clienți
-- ---------------------------------------------------------------------------
INSERT INTO "companies" (
  "id", "name", "taxCode", "tradeRegistryNumber", "registeredAddress",
  "phone", "email", "legalRepresentative", "contactPerson", "contactPersonPhone",
  "color", "createdAt", "updatedAt"
) VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'Agromec SRL',
    'RO18234455',
    'J32/1122/2015',
    'Str. Industriilor nr. 12, Zalău, Sălaj',
    '0741223344',
    'contact@agromec.ro',
    'Ion Vasilescu',
    'Ion Vasilescu',
    '0741223344',
    '#7A8450',
    NOW(), NOW()
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Metalexport SA',
    'RO9012233',
    'J12/3344/2010',
    'Bd. Metalurgiei nr. 5, Cluj-Napoca',
    '0755667889',
    'office@metalexport.ro',
    'Elena Popa',
    'Elena Popa',
    '0755667889',
    '#3B7EA1',
    NOW(), NOW()
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'Lidl România',
    'RO7788990',
    'J40/5566/2008',
    'Șos. Virtuții nr. 148, București',
    '0212334556',
    'achizitii@lidl.ro',
    'Andrei Marin',
    'Andrei Marin',
    '0212334556',
    '#C9A227',
    NOW(), NOW()
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    'Steelcor Invest',
    'RO3344556',
    'J24/7788/2012',
    'Str. Oțelarilor nr. 3, Reșița',
    '0729112233',
    'contact@steelcor.ro',
    'Sorina Dumitru',
    'Sorina Dumitru',
    '0729112233',
    '#6B6B6B',
    NOW(), NOW()
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    'Dacia Groupe',
    'RO4455667',
    'J31/9900/2011',
    'Str. Uzinei nr. 1, Mioveni, Argeș',
    '0261445778',
    'furnizori@daciagroupe.ro',
    'Radu Constantin',
    'Radu Constantin',
    '0261445778',
    '#B5533C',
    NOW(), NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) persons (5)
-- ---------------------------------------------------------------------------
INSERT INTO "persons" (
  "id", "firstName", "lastName", "email", "phone", "employeeRoleId",
  "createdAt", "updatedAt"
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Admin',
    'MetalXpert',
    'admin@metalxpert.ro',
    '0721000001',
    '10000000-0000-0000-0000-000000000005',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Employee',
    'MetalXpert',
    'employee@metalxpert.ro',
    '0721000002',
    '10000000-0000-0000-0000-000000000001',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Ion',
    'Popescu',
    'ion.popescu@metalxpert.ro',
    '0721000003',
    '10000000-0000-0000-0000-000000000001',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Vasile',
    'Ionescu',
    'vasile.ionescu@metalxpert.ro',
    '0721000004',
    '10000000-0000-0000-0000-000000000002',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Andrei',
    'Marin',
    'andrei.marin@metalxpert.ro',
    '0721000005',
    '10000000-0000-0000-0000-000000000003',
    NOW(), NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) users (5) — parolă: ChangeMe123! (bcrypt cost 12)
-- ---------------------------------------------------------------------------
INSERT INTO "users" (
  "id", "email", "passwordHash", "role", "isActive", "createdAt", "updatedAt", "personId"
) VALUES
  (
    '00000000-0000-0000-0000-000000000011',
    'admin@metalxpert.ro',
    '$2a$12$Ztay3BkdXcNTQaw0Agzjreu6xkEf26L5wtUkVCBonm8jq9nus2f1.',
    'ADMIN',
    true,
    NOW(), NOW(),
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'employee@metalxpert.ro',
    '$2a$12$Ztay3BkdXcNTQaw0Agzjreu6xkEf26L5wtUkVCBonm8jq9nus2f1.',
    'EMPLOYEE',
    true,
    NOW(), NOW(),
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    'ion.popescu@metalxpert.ro',
    '$2a$12$Ztay3BkdXcNTQaw0Agzjreu6xkEf26L5wtUkVCBonm8jq9nus2f1.',
    'EMPLOYEE',
    true,
    NOW(), NOW(),
    '00000000-0000-0000-0000-000000000003'
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    'vasile.ionescu@metalxpert.ro',
    '$2a$12$Ztay3BkdXcNTQaw0Agzjreu6xkEf26L5wtUkVCBonm8jq9nus2f1.',
    'EMPLOYEE',
    true,
    NOW(), NOW(),
    '00000000-0000-0000-0000-000000000004'
  ),
  (
    '00000000-0000-0000-0000-000000000015',
    'andrei.marin@metalxpert.ro',
    '$2a$12$Ztay3BkdXcNTQaw0Agzjreu6xkEf26L5wtUkVCBonm8jq9nus2f1.',
    'EMPLOYEE',
    true,
    NOW(), NOW(),
    '00000000-0000-0000-0000-000000000005'
  )
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6) projects (5)
-- readyForExecution = true → vizibile în app mobile (pontaj)
-- ---------------------------------------------------------------------------
INSERT INTO "projects" (
  "id", "code", "name", "companyId", "status",
  "startDate", "dueDate", "readyForExecution", "color",
  "createdAt", "updatedAt"
) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    'PRJ-0001',
    'Hală depozitare Agromec',
    'c0000000-0000-0000-0000-000000000001',
    'IN_PRODUCTIE',
    '2026-05-01'::timestamp,
    '2026-07-15'::timestamp,
    true,
    '#C9A227',
    NOW(), NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'PRJ-0002',
    'Structură hală Metalexport',
    'c0000000-0000-0000-0000-000000000002',
    'IN_PRODUCTIE',
    '2026-06-01'::timestamp,
    '2026-08-20'::timestamp,
    true,
    '#7A8450',
    NOW(), NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'PRJ-0003',
    'Copertină acces Lidl',
    'c0000000-0000-0000-0000-000000000003',
    'PREGATIT_LIVRARE',
    '2026-05-15'::timestamp,
    '2026-07-10'::timestamp,
    true,
    '#B5533C',
    NOW(), NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    'PRJ-0004',
    'Balustrade industriale Steelcor',
    'c0000000-0000-0000-0000-000000000004',
    'IN_PRODUCTIE',
    '2026-05-01'::timestamp,
    '2026-07-01'::timestamp,
    true,
    '#6B6B6B',
    NOW(), NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    'PRJ-0005',
    'Grindă macara Dacia',
    'c0000000-0000-0000-0000-000000000005',
    'CASTIGAT',
    '2026-07-01'::timestamp,
    '2026-09-30'::timestamp,
    false,
    '#2F6F4E',
    NOW(), NOW()
  )
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7) timesheets (5)
-- ---------------------------------------------------------------------------
INSERT INTO "timesheets" (
  "id", "personId", "userId", "projectId", "activityId",
  "workDate", "durationMinutes", "notes", "createdAt", "updatedAt"
) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000012',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    '2026-07-07 00:00:00'::timestamp,
    270,
    'Sudare structură principală',
    NOW(), NOW()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000013',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '2026-07-07 00:00:00'::timestamp,
    450,
    'Asamblare cadre',
    NOW(), NOW()
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000014',
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    '2026-07-06 00:00:00'::timestamp,
    480,
    'Vopsire copertină',
    NOW(), NOW()
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000012',
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '2026-07-08 00:00:00'::timestamp,
    240,
    'Debitare balustrade',
    NOW(), NOW()
  ),
  (
    '40000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000015',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000005',
    '2026-07-05 00:00:00'::timestamp,
    240,
    'Rectificare îmbinări',
    NOW(), NOW()
  )
ON CONFLICT ("id") DO NOTHING;

COMMIT;

-- =============================================================================
-- Verificare (rulează separat):
-- =============================================================================
-- SELECT 'employee_roles' AS t, COUNT(*) FROM "employee_roles"
-- UNION ALL SELECT 'activities', COUNT(*) FROM "activities"
-- UNION ALL SELECT 'companies', COUNT(*) FROM "companies"
-- UNION ALL SELECT 'persons', COUNT(*) FROM "persons"
-- UNION ALL SELECT 'users', COUNT(*) FROM "users"
-- UNION ALL SELECT 'projects', COUNT(*) FROM "projects"
-- UNION ALL SELECT 'timesheets', COUNT(*) FROM "timesheets";
