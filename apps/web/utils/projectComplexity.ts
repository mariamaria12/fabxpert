import { formatProjectComplexity, PROJECT_COMPLEXITY_LEVELS } from '@fabxpert/shared';

const piecesPerTonFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });

/** Reading form, e.g. "142 piese/t". */
export function formatPiecesPerTon(piecesPerTon: number): string {
  return `${piecesPerTonFormat.format(piecesPerTon)} piese/t`;
}

/** The whole scale on one line, e.g. "C1 ≤ 50 · C2 ≤ 150 · C3 ≤ 300 · C4 > 300 piese/t". */
export function formatComplexityScale(): string {
  const steps = PROJECT_COMPLEXITY_LEVELS.map((entry, index) => {
    const label = formatProjectComplexity(entry.level);
    if (entry.maxPiecesPerTon !== null) {
      return `${label} ≤ ${entry.maxPiecesPerTon}`;
    }
    return `${label} > ${PROJECT_COMPLEXITY_LEVELS[index - 1]?.maxPiecesPerTon ?? 0}`;
  });
  return `${steps.join(' · ')} piese/t`;
}
