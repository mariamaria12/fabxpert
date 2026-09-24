/**
 * How the shop grades a project's complexity: by parts per ton. A few heavy
 * parts are simple work, many small ones are not. Each class keeps its upper
 * bound — 50 is still C1 — and C4 is open-ended.
 */
export const PROJECT_COMPLEXITY_LEVELS = [
  { level: 1, maxPiecesPerTon: 50 },
  { level: 2, maxPiecesPerTon: 150 },
  { level: 3, maxPiecesPerTon: 300 },
  { level: 4, maxPiecesPerTon: null },
] as const;

export type ProjectComplexityLevel = (typeof PROJECT_COMPLEXITY_LEVELS)[number]['level'];

/** The class a parts-per-ton figure falls in; null while it is not filled in. */
export function projectComplexityLevel(
  piecesPerTon: number | null | undefined,
): ProjectComplexityLevel | null {
  if (piecesPerTon === null || piecesPerTon === undefined || !(piecesPerTon >= 0)) {
    return null;
  }
  const match = PROJECT_COMPLEXITY_LEVELS.find(
    (entry) => entry.maxPiecesPerTon === null || piecesPerTon <= entry.maxPiecesPerTon,
  );
  return match?.level ?? null;
}

/** "C1" … "C4". */
export function formatProjectComplexity(level: ProjectComplexityLevel): string {
  return `C${level}`;
}
