#!/usr/bin/env tsx
/**
 * One-time backfill for `projects.denumireLucrare`, derived from the project name.
 *
 * Name template:
 *   {data}_{client}( ({judet}))?#{numar}_{tip}_{denumire_lucrare}_{finisaj}(_{acronim})?
 *
 * Extraction (see extractDenumireLucrare): anchor on `_(FAB|DEB|CNC)_`, then strip
 * the acronym (matched against the project's `code`) and the finisaj segments from
 * the right. Whatever remains is the denumire lucrare.
 *
 * Usage:
 *   pnpm --filter @fabxpert/db exec tsx scripts/backfill-denumire-lucrare.ts            # dry-run
 *   pnpm --filter @fabxpert/db exec tsx scripts/backfill-denumire-lucrare.ts --apply    # writes
 *
 * Dry-run is the default: nothing is written without --apply. Only rows where
 * denumireLucrare IS NULL are touched, so the script is safe to re-run — values
 * filled in manually between runs are never overwritten.
 */
import { createSeedPrismaClient } from '../prisma/create-seed-prisma';

const prisma = createSeedPrismaClient();

/** Structure validation + the `rest` that follows the type anchor. */
const PROJECT_NAME_RE =
  /^(?<data>\d{8})_(?<client>.+?)[\s_]*(?:\((?<judet>[A-Z]{1,3})\))?[\s_]*#(?<numar>[\d-]+)_(?<tip>FAB|DEB|CNC)_(?<rest>.+)$/;

/** Finisaj vocabulary, matched case-insensitively against a whole segment. */
const FINISAJ_RE = /^(?:ZINCARE|RAL\s*\d+|BRUT|VOPSIRE|GRUNDUIRE|INOX)$/i;

/** ZINCARE_RAL9002 is the longest compound finisaj seen in the data. */
const MAX_FINISAJ_SEGMENTS = 2;

/** Shortest normalized acronym we trust for a prefix match. */
const MIN_ACRONYM_LENGTH = 2;

/** Edit distance under which a near-miss is a suspected typo, not a mismatch. */
const TYPO_DISTANCE = 2;

type ExtractionOk = {
  ok: true;
  denumireLucrare: string;
  removedFinisaj: string[];
  removedAcronim: string[];
};

type ExtractionFailure = {
  ok: false;
  reason: string;
};

type Extraction = ExtractionOk | ExtractionFailure;

/** Uppercase, drop spaces/hyphens/underscores — "CMW-90" and "cmw 90" collapse to "CMW90". */
function normalizeAcronym(value: string): string {
  return value.toUpperCase().replace(/[\s\-_]/g, '');
}

function isFinisajSegment(segment: string): boolean {
  return FINISAJ_RE.test(segment.trim());
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }

  return previous[b.length];
}

type AcronymMatch =
  | { kind: 'none' }
  | { kind: 'matched'; count: number }
  | { kind: 'uncertain'; candidate: string; distance: number };

/**
 * Find how many trailing segments make up the project acronym.
 * Longest match wins so "K-1_DS12" beats the bare "DS12" tail.
 * A near-miss (typo) is reported as uncertain instead of being stripped.
 */
function matchAcronym(segments: string[], code: string): AcronymMatch {
  const target = normalizeAcronym(code);
  if (target.length < MIN_ACRONYM_LENGTH) {
    return { kind: 'none' };
  }

  let bestPrefix: number | null = null;
  let closest: { candidate: string; distance: number } | null = null;

  // Leave at least one segment for the denumire itself.
  for (let count = segments.length - 1; count >= 1; count -= 1) {
    const tail = segments.slice(segments.length - count);
    if (tail.every(isFinisajSegment)) {
      continue;
    }

    const candidate = normalizeAcronym(tail.join(''));
    if (candidate.length < MIN_ACRONYM_LENGTH) {
      continue;
    }

    if (candidate === target) {
      return { kind: 'matched', count };
    }

    // The name may carry a shortened acronym ("CMW-90" vs "CMW-90-2" in the DB).
    if (bestPrefix === null && target.startsWith(candidate)) {
      bestPrefix = count;
    }

    const distance = levenshtein(candidate, target);
    if (closest === null || distance < closest.distance) {
      closest = { candidate, distance };
    }
  }

  if (bestPrefix !== null) {
    return { kind: 'matched', count: bestPrefix };
  }

  if (
    closest !== null &&
    closest.distance <= TYPO_DISTANCE &&
    closest.candidate.length >= 4 &&
    Math.abs(closest.candidate.length - target.length) <= TYPO_DISTANCE
  ) {
    return { kind: 'uncertain', candidate: closest.candidate, distance: closest.distance };
  }

  return { kind: 'none' };
}

/** Strip trailing finisaj segments, at most MAX_FINISAJ_SEGMENTS, keeping one segment. */
function stripFinisaj(segments: string[]): { kept: string[]; removed: string[] } {
  const kept = [...segments];
  const removed: string[] = [];

  while (kept.length > 1 && removed.length < MAX_FINISAJ_SEGMENTS) {
    const last = kept[kept.length - 1];
    if (!isFinisajSegment(last)) {
      break;
    }
    removed.unshift(last);
    kept.pop();
  }

  return { kept, removed };
}

export function extractDenumireLucrare(name: string, code: string): Extraction {
  const match = PROJECT_NAME_RE.exec(name.trim());
  if (!match?.groups) {
    return { ok: false, reason: 'numele nu respectă template-ul' };
  }

  const segments = match.groups.rest.split('_');

  const acronym = matchAcronym(segments, code);
  if (acronym.kind === 'uncertain') {
    return {
      ok: false,
      reason: `acronim incert: "${acronym.candidate}" în nume vs "${normalizeAcronym(code)}" în DB (distanță ${acronym.distance})`,
    };
  }

  const removedAcronim =
    acronym.kind === 'matched' ? segments.slice(segments.length - acronym.count) : [];
  const withoutAcronim =
    acronym.kind === 'matched' ? segments.slice(0, segments.length - acronym.count) : segments;

  const { kept, removed: removedFinisaj } = stripFinisaj(withoutAcronim);

  const denumireLucrare = kept.join('_').replace(/^[\s_]+|[\s_]+$/g, '');
  if (!denumireLucrare) {
    return { ok: false, reason: 'denumirea rezultată este goală' };
  }

  return { ok: true, denumireLucrare, removedFinisaj, removedAcronim };
}

type ProjectRow = {
  id: string;
  name: string;
  code: string;
  denumireLucrare: string | null;
};

function truncate(value: string, width: number): string {
  return value.length <= width ? value.padEnd(width) : `${value.slice(0, width - 1)}…`;
}

function printTable(rows: Array<{ project: ProjectRow; result: ExtractionOk }>) {
  const columns: Array<[string, number]> = [
    ['NUME PROIECT', 60],
    ['DENUMIRE LUCRARE', 34],
    ['FINISAJ ELIMINAT', 20],
    ['ACRONIM ELIMINAT', 18],
  ];

  const header = columns.map(([label, width]) => truncate(label, width)).join('  ');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const { project, result } of rows) {
    const cells = [
      project.name,
      result.denumireLucrare,
      result.removedFinisaj.join('_') || '—',
      result.removedAcronim.join('_') || '—',
    ];
    console.log(cells.map((cell, i) => truncate(cell, columns[i][1])).join('  '));
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const total = await prisma.project.count();
  const projects: ProjectRow[] = await prisma.project.findMany({
    select: { id: true, name: true, code: true, denumireLucrare: true },
    orderBy: { name: 'asc' },
  });

  const skipped = projects.filter((p) => p.denumireLucrare !== null);
  const pending = projects.filter((p) => p.denumireLucrare === null);

  const parsed: Array<{ project: ProjectRow; result: ExtractionOk }> = [];
  const failed: Array<{ project: ProjectRow; reason: string }> = [];

  for (const project of pending) {
    const result = extractDenumireLucrare(project.name, project.code);
    if (result.ok) {
      parsed.push({ project, result });
    } else {
      failed.push({ project, reason: result.reason });
    }
  }

  console.log(apply ? '\n=== APLICARE (scriere în DB) ===\n' : '\n=== DRY-RUN (nu se scrie nimic) ===\n');

  if (parsed.length > 0) {
    printTable(parsed);
  } else {
    console.log('Niciun proiect de populat.');
  }

  if (failed.length > 0) {
    console.log('\n=== NECESITĂ COMPLETARE MANUALĂ (rămân null) ===\n');
    for (const { project, reason } of failed) {
      console.log(`  [${project.code}] ${project.name}\n      → ${reason}`);
    }
  }

  let populated = 0;
  if (apply) {
    for (const { project, result } of parsed) {
      // Re-check the null guard inside the write so a concurrent manual edit wins.
      const updated = await prisma.project.updateMany({
        where: { id: project.id, denumireLucrare: null },
        data: { denumireLucrare: result.denumireLucrare },
      });
      populated += updated.count;
    }
  }

  console.log('\n=== SUMAR ===');
  console.log(`  Total proiecte:                ${total}`);
  console.log(
    `  Populate:                      ${apply ? populated : `${parsed.length} (dry-run — nescrise)`}`,
  );
  console.log(`  Sărite (deja completate):      ${skipped.length}`);
  console.log(`  Eșuate (completare manuală):   ${failed.length}`);

  if (!apply && parsed.length > 0) {
    console.log('\nRulează din nou cu --apply pentru a scrie în baza de date.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
