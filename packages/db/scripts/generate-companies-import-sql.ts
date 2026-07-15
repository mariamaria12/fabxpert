#!/usr/bin/env tsx
/**
 * Generate a one-off INSERT script for production companies import.
 *
 * Usage:
 *   pnpm --filter @fabxpert/db exec tsx scripts/generate-companies-import-sql.ts path/to/companies.tsv
 *   pnpm --filter @fabxpert/db exec tsx scripts/generate-companies-import-sql.ts < companies.tsv
 *
 * Writes: packages/db/scripts/import-companies-prod.sql
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COMPANY_IMPORT_FIELD_KEYS,
  parseCompanyImportRows,
  type CompanyImportRow,
} from '../../../shared/src/companyImport';

const OUTPUT_PATH = resolve(__dirname, 'import-companies-prod.sql');
const BATCH_SIZE = 25;

const DUPLICATE_TAX_CODE_GROUPS: Array<{ taxCode: string; expectedNames: string[] }> = [
  {
    taxCode: '43615620',
    expectedNames: [
      'ORIZONT ELECTRIC S.R.L.',
      'ORIZONT ELECTRIC S.R.L. (Z)',
      'ORIZONT ELECTRIC S.R.L. (AR)',
    ],
  },
  {
    taxCode: '24214656',
    expectedNames: [
      'REIF INFRA SRL (BOSCH)',
      'REIF INFRA SRL (CJ)',
      'REIF INFRA SRL (CT)',
    ],
  },
  {
    taxCode: '39789822',
    expectedNames: ['STILL WORKING S.R.L.', 'STILL WORKING S.R.L. (BCS)'],
  },
];

function readInputText(argv: string[]): string {
  const fileArg = argv[2];
  if (fileArg && fileArg !== '-') {
    return readFileSync(resolve(fileArg), 'utf8');
  }
  return readFileSync(0, 'utf8');
}

function sqlString(value: string): string {
  const tag = `imp${randomUUID().replace(/-/g, '')}`;
  return `$${tag}$${value}$${tag}$`;
}

function sqlNullable(value: string | undefined): string {
  return value === undefined ? 'NULL' : sqlString(value);
}

function rowToValues(row: CompanyImportRow): string {
  const columns = [
    'gen_random_uuid()',
    sqlString(row.name),
    sqlNullable(row.taxCode),
    sqlNullable(row.tradeRegistryNumber),
    sqlNullable(row.registeredAddress),
    sqlNullable(row.phone),
    sqlNullable(row.deliveryAddress),
    sqlNullable(row.legalRepresentative),
    sqlNullable(row.email),
    sqlNullable(row.contactPerson),
    sqlNullable(row.contactPersonPhone),
    'NULL',
    'NOW()',
    'NOW()',
    'NULL',
  ];

  return `  (${columns.join(', ')})`;
}

function buildInsertBatch(rows: CompanyImportRow[]): string {
  const columnList = [
    '"id"',
    '"name"',
    '"taxCode"',
    '"tradeRegistryNumber"',
    '"registeredAddress"',
    '"phone"',
    '"deliveryAddress"',
    '"legalRepresentative"',
    '"email"',
    '"contactPerson"',
    '"contactPersonPhone"',
    '"color"',
    '"createdAt"',
    '"updatedAt"',
    '"deletedAt"',
  ].join(', ');

  return [
    `INSERT INTO "companies" (${columnList}) VALUES`,
    rows.map((row) => rowToValues(row)).join(',\n'),
    ';',
  ].join('\n');
}

function buildVerificationSql(): string {
  const duplicateChecks = DUPLICATE_TAX_CODE_GROUPS.map((group) => {
    const names = group.expectedNames.map((name) => sqlString(name)).join(', ');
    return `-- ${group.taxCode} → ${group.expectedNames.length} rows
SELECT "name", "taxCode"
FROM "companies"
WHERE "taxCode" = ${sqlString(group.taxCode)}
ORDER BY "name";`;
  }).join('\n\n');

  return `-- Verification
SELECT COUNT(*) AS company_count FROM "companies";

${duplicateChecks}`;
}

function detectFibrexAnomaly(rows: CompanyImportRow[]): string | null {
  const match = rows.find((row) => row.name === 'FIBREX CO SRL');
  if (!match) {
    return null;
  }
  if (match.deliveryAddress === 'IOAN POJAR') {
    return 'FIBREX CO SRL: deliveryAddress contains "IOAN POJAR" (likely a data-entry error — imported verbatim).';
  }
  return `FIBREX CO SRL: deliveryAddress is "${match.deliveryAddress ?? '(null)'}" (expected "IOAN POJAR" anomaly flag).`;
}

function main(): void {
  const input = readInputText(process.argv);
  const rows = parseCompanyImportRows(input);

  if (rows.length === 0) {
    throw new Error('No valid company rows found in input.');
  }

  const batches: string[] = [];
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    batches.push(buildInsertBatch(rows.slice(index, index + BATCH_SIZE)));
  }

  const header = `-- =============================================================================
-- FabXpert PROD — one-off companies import (Supabase SQL Editor → paste → Run)
--
-- Prerequisites:
--   1. companies table is EMPTY (truncated before import)
--
-- Generated rows: ${rows.length}
-- id: gen_random_uuid() per row (@default(uuid()) is Prisma client-side only)
-- createdAt / updatedAt: NOW() (updatedAt has no DB default)
-- color / deletedAt: NULL for all rows
-- =============================================================================

BEGIN;

`;

  const footer = `
COMMIT;

${buildVerificationSql()}
`;

  writeFileSync(OUTPUT_PATH, `${header}${batches.join('\n\n')}\n${footer}`, 'utf8');

  console.log(`Wrote ${rows.length} companies to ${OUTPUT_PATH}`);
  console.log(`Columns: ${COMPANY_IMPORT_FIELD_KEYS.join(', ')}`);

  const metalXpert = rows.find((row) => row.name.includes('Metal Xpert'));
  if (metalXpert) {
    console.log('Note: S.C. Metal Xpert S.R.L. appears in the import list (presumably intentional).');
  }

  const fibrex = detectFibrexAnomaly(rows);
  if (fibrex) {
    console.log(`FLAG: ${fibrex}`);
  }

  for (const group of DUPLICATE_TAX_CODE_GROUPS) {
    const count = rows.filter((row) => row.taxCode === group.taxCode).length;
    console.log(`Duplicate taxCode ${group.taxCode}: ${count} row(s) (expected ${group.expectedNames.length})`);
  }
}

main();
