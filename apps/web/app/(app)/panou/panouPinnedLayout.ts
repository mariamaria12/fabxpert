import type { PinnedProjectSummaryRow } from '@fabxpert/shared';

function compareByPanouIndex(
  left: PinnedProjectSummaryRow,
  right: PinnedProjectSummaryRow,
): number {
  const leftIndex = left.indexPanou ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = right.indexPanou ?? Number.MAX_SAFE_INTEGER;
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  return left.name.localeCompare(right.name, 'ro');
}

export function splitPinnedProjectsByColumn(
  projects: PinnedProjectSummaryRow[],
): [PinnedProjectSummaryRow[], PinnedProjectSummaryRow[]] {
  const column0 = projects
    .filter((project) => (project.panouColumn ?? 0) === 0)
    .sort(compareByPanouIndex);
  const column1 = projects
    .filter((project) => project.panouColumn === 1)
    .sort(compareByPanouIndex);

  return [column0, column1];
}

/** Reading order for single-column view (row-major interleave of the two columns). */
export function flattenPinnedProjectsForOneColumn(
  projects: PinnedProjectSummaryRow[],
): PinnedProjectSummaryRow[] {
  const [column0, column1] = splitPinnedProjectsByColumn(projects);
  const flattened: PinnedProjectSummaryRow[] = [];
  const maxRows = Math.max(column0.length, column1.length);

  for (let row = 0; row < maxRows; row += 1) {
    if (column0[row]) {
      flattened.push(column0[row]);
    }
    if (column1[row]) {
      flattened.push(column1[row]);
    }
  }

  return flattened;
}

/** Inverse of flattenPinnedProjectsForOneColumn (row-major pairs back into two columns). */
export function unflattenOneColumnOrderToColumns(
  flattened: PinnedProjectSummaryRow[],
): [PinnedProjectSummaryRow[], PinnedProjectSummaryRow[]] {
  const column0: PinnedProjectSummaryRow[] = [];
  const column1: PinnedProjectSummaryRow[] = [];

  for (let index = 0; index < flattened.length; index += 1) {
    if (index % 2 === 0) {
      column0.push(flattened[index]);
    } else {
      column1.push(flattened[index]);
    }
  }

  return [column0, column1];
}

export function isPinnedLayoutCollapsedToOneColumn(
  column0: PinnedProjectSummaryRow[],
  column1: PinnedProjectSummaryRow[],
): boolean {
  return column1.length === 0 && column0.length > 1;
}

export function mergePinnedProjectColumns(
  column0: PinnedProjectSummaryRow[],
  column1: PinnedProjectSummaryRow[],
): PinnedProjectSummaryRow[] {
  return [
    ...column0.map((project, index) => ({
      ...project,
      panouColumn: 0,
      indexPanou: index,
    })),
    ...column1.map((project, index) => ({
      ...project,
      panouColumn: 1,
      indexPanou: index,
    })),
  ];
}

export function getPinnedProjectColumn(
  projects: PinnedProjectSummaryRow[],
  projectId: string,
): 0 | 1 | null {
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    return null;
  }

  return (project.panouColumn ?? 0) === 0 ? 0 : 1;
}
