import type { Prisma, PrismaClient } from '@prisma/client';
import type { AssemblyProgressDto } from '@fabxpert/shared/dto/assembly.dto';

/** Running totals per assembly and activity while the two sources are merged. */
type ProgressTally = { quantityDone: number; manualQuantity: number };

function tallyKey(assemblyId: string, activityId: string): string {
  return `${assemblyId}:${activityId}`;
}

/**
 * Pieces done per assembly per activity, over both sources: the timesheets that
 * covered the mark, and the entries an admin ticked by hand for work that never
 * passed through a timesheet. Nothing is cached on the assembly itself, so a
 * corrected timesheet moves the number with it.
 *
 * `activityId` is grouped from each row's own copy — Prisma cannot group by a
 * field reached through a relation. Soft-deleted timesheets still have to be
 * filtered through the relation, which is a lookup by primary key.
 */
export async function loadAssemblyProgress(
  prisma: PrismaClient | Prisma.TransactionClient,
  assemblyIds: string[],
): Promise<Map<string, AssemblyProgressDto[]>> {
  const byAssembly = new Map<string, AssemblyProgressDto[]>();
  if (assemblyIds.length === 0) {
    return byAssembly;
  }

  const [logged, manual] = await Promise.all([
    prisma.timesheetAssembly.groupBy({
      by: ['assemblyId', 'activityId'],
      where: {
        assemblyId: { in: assemblyIds },
        timesheet: { deletedAt: null },
      },
      _sum: { quantityDone: true },
    }),
    prisma.assemblyManualProgress.findMany({
      where: { assemblyId: { in: assemblyIds } },
      select: { assemblyId: true, activityId: true, quantityDone: true },
    }),
  ]);

  if (logged.length === 0 && manual.length === 0) {
    return byAssembly;
  }

  const tallies = new Map<string, ProgressTally & { assemblyId: string; activityId: string }>();
  const tallyFor = (assemblyId: string, activityId: string) => {
    const key = tallyKey(assemblyId, activityId);
    let tally = tallies.get(key);
    if (!tally) {
      tally = { assemblyId, activityId, quantityDone: 0, manualQuantity: 0 };
      tallies.set(key, tally);
    }
    return tally;
  };

  for (const row of logged) {
    tallyFor(row.assemblyId, row.activityId).quantityDone += row._sum.quantityDone ?? 0;
  }

  for (const row of manual) {
    const tally = tallyFor(row.assemblyId, row.activityId);
    tally.quantityDone += row.quantityDone;
    tally.manualQuantity += row.quantityDone;
  }

  const activities = await prisma.activity.findMany({
    where: { id: { in: [...new Set([...tallies.values()].map((row) => row.activityId))] } },
    select: { id: true, name: true, color: true },
  });
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  for (const tally of tallies.values()) {
    if (tally.quantityDone === 0) {
      continue;
    }

    const activity = activityById.get(tally.activityId);
    const rows = byAssembly.get(tally.assemblyId) ?? [];
    rows.push({
      activityId: tally.activityId,
      activityName: activity?.name ?? '',
      activityColor: activity?.color ?? null,
      quantityDone: tally.quantityDone,
      manualQuantity: tally.manualQuantity,
    });
    byAssembly.set(tally.assemblyId, rows);
  }

  for (const rows of byAssembly.values()) {
    rows.sort((a, b) => a.activityName.localeCompare(b.activityName, 'ro'));
  }

  return byAssembly;
}

/** Pieces done for one activity, used to sort a list into pending/completed. */
export function doneForActivity(
  progress: AssemblyProgressDto[],
  activityId: string,
): number {
  return progress.find((row) => row.activityId === activityId)?.quantityDone ?? 0;
}
