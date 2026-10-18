import { Prisma, type PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * SQL that is true when the activity tracks assemblies on the project: the
 * activity is flagged and the project has not switched it off for itself.
 */
export function tracksAssembliesOnProjectSql(
  tracksAssemblies: Prisma.Sql,
  projectId: Prisma.Sql,
  activityId: Prisma.Sql,
): Prisma.Sql {
  return Prisma.sql`(${tracksAssemblies} AND NOT EXISTS (
    SELECT 1 FROM project_untracked_activities pua
    WHERE pua."projectId" = ${projectId} AND pua."activityId" = ${activityId}
  ))`;
}

/** Activities each project has switched off; projects without any are absent. */
export async function loadUntrackedActivityIds(
  db: Db,
  projectIds: string[],
): Promise<Map<string, string[]>> {
  const byProject = new Map<string, string[]>();
  if (projectIds.length === 0) {
    return byProject;
  }

  const rows = await db.projectUntrackedActivity.findMany({
    where: { projectId: { in: projectIds } },
    select: { projectId: true, activityId: true },
  });
  for (const row of rows) {
    const ids = byProject.get(row.projectId) ?? [];
    ids.push(row.activityId);
    byProject.set(row.projectId, ids);
  }
  return byProject;
}
