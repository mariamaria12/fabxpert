import type { Prisma, PrismaClient } from '@prisma/client';
import type { AssemblyProgressDto } from '@fabxpert/shared/dto/assembly.dto';

/**
 * Pieces done per assembly per activity, grouped straight out of the link
 * table. Nothing is cached on the assembly itself, so a corrected timesheet
 * moves the number with it.
 *
 * `activityId` is grouped from the link's own copy — Prisma cannot group by a
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

  const grouped = await prisma.timesheetAssembly.groupBy({
    by: ['assemblyId', 'activityId'],
    where: {
      assemblyId: { in: assemblyIds },
      timesheet: { deletedAt: null },
    },
    _sum: { quantityDone: true },
  });

  if (grouped.length === 0) {
    return byAssembly;
  }

  const activities = await prisma.activity.findMany({
    where: { id: { in: [...new Set(grouped.map((row) => row.activityId))] } },
    select: { id: true, name: true, color: true },
  });
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  for (const row of grouped) {
    const quantityDone = row._sum.quantityDone ?? 0;
    if (quantityDone === 0) {
      continue;
    }

    const activity = activityById.get(row.activityId);
    const rows = byAssembly.get(row.assemblyId) ?? [];
    rows.push({
      activityId: row.activityId,
      activityName: activity?.name ?? '',
      activityColor: activity?.color ?? null,
      quantityDone,
    });
    byAssembly.set(row.assemblyId, rows);
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
