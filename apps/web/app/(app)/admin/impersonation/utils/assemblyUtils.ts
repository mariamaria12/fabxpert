import type { ProjectAssemblyDto } from '@fabxpert/shared';

/** An assembly the worker picked, with the pieces being reported right now. */
export type AssemblySelection = {
  assembly: ProjectAssemblyDto;
  quantity: number;
};

/** Above this many open pieces a row of tick boxes stops being readable. */
export const TICK_GRID_LIMIT = 12;

export function totalSelectedPieces(selection: AssemblySelection[]): number {
  return selection.reduce((total, entry) => total + entry.quantity, 0);
}

/**
 * Millimetres and kilograms as the drawing list states them. Thousands are not
 * grouped — "4.320 mm" reads like four and a bit next to a length in metres.
 */
function formatMeasure(value: number): string {
  return value.toLocaleString('ro-RO', { maximumFractionDigits: 2, useGrouping: false });
}

/**
 * Romanian counts: one takes the singular, and from twenty up the noun needs
 * "de" — 1 bucată, 3 bucăți, 24 de bucăți.
 */
export function countWithNoun(count: number, singular: string, plural: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }

  const needsDe = count % 100 === 0 || count % 100 >= 20;

  return `${count} ${needsDe ? 'de ' : ''}${plural}`;
}

/**
 * The line under the mark. The weight is only worth the room once the pieces are
 * being counted — in the picker it pushes the line onto a second row.
 */
export function formatAssemblyMeta(
  assembly: ProjectAssemblyDto,
  options: { includeProfile?: boolean; includeWeight?: boolean } = {},
): string {
  const parts: string[] = [];

  if (options.includeProfile && assembly.profile) {
    parts.push(assembly.profile);
  }
  if (assembly.length !== null) {
    parts.push(`${formatMeasure(assembly.length)} mm`);
  }
  if (options.includeWeight && assembly.weightPerPiece !== null) {
    parts.push(`${formatMeasure(assembly.weightPerPiece)} kg/buc`);
  }

  return parts.join(' · ');
}

export type AssemblyGroup = {
  key: string;
  label: string;
  assemblies: ProjectAssemblyDto[];
};

/** Groups by profile, keeping the import order inside and between the groups. */
export function groupAssembliesByProfile(assemblies: ProjectAssemblyDto[]): AssemblyGroup[] {
  const groups = new Map<string, AssemblyGroup>();

  for (const assembly of assemblies) {
    const key = assembly.profileKey ?? '';
    const group = groups.get(key);

    if (group) {
      group.assemblies.push(assembly);
    } else {
      groups.set(key, {
        key,
        label: assembly.profile ?? 'Fără profil',
        assemblies: [assembly],
      });
    }
  }

  return [...groups.values()];
}

/** Search runs on the mark and on the profile — both are on the drawing. */
export function matchesAssemblySearch(assembly: ProjectAssemblyDto, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return (
    assembly.name.toLowerCase().includes(query) ||
    (assembly.profile ?? '').toLowerCase().includes(query)
  );
}
