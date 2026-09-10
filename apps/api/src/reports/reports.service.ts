import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ActiveProjectsReportResponse,
  ActivityNormsResponse,
  ProductivityReportResponse,
  ProjectReportResponse,
} from '@fabxpert/shared/dto/report.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildProjectSummaryAssemblyDoneQuery,
  buildProjectSummaryAssemblyTotalQuery,
  indexProjectAssemblyProgress,
  type ProjectAssemblyProgressIndex,
  type ProjectSummaryAssemblyDoneSqlRow,
  type ProjectSummaryAssemblyTotalSqlRow,
} from '../timesheet/timesheet-project-summary.util';
import {
  isPastInterval,
  type ResolvedNormsWindow,
  type ResolvedReportPeriod,
} from './report-period.util';
import {
  buildActivityAggregateQuery,
  buildProjectAggregateQuery,
  shapeProductivityReport,
  type ActivityAggregateRow,
  type ProjectAggregateRow,
} from './reports-productivity.util';
import {
  buildProjectReportEntriesQuery,
  shapeProjectReport,
  type ProjectReportEntrySqlRow,
} from './reports-project.util';
import {
  buildActiveProjectActivitiesQuery,
  buildActiveProjectsQuery,
  shapeActiveProjectsReport,
  type ActiveProjectActivitySqlRow,
  type ActiveProjectSqlRow,
} from './reports-active.util';
import {
  buildNormActivitiesQuery,
  buildNormProjectsQuery,
  shapeActivityNorms,
  type NormActivitySqlRow,
  type NormProjectSqlRow,
} from './reports-norms.util';

type CacheEntry = { expiresAt: number; value: ProductivityReportResponse };

const EMPTY_ASSEMBLY_INDEX: ProjectAssemblyProgressIndex = {
  doneByProjectActivity: new Map(),
  weightDoneByProjectActivity: new Map(),
  totalByProject: new Map(),
  weightTotalByProject: new Map(),
  withoutWeightByProject: new Map(),
  assemblyCountByProject: new Map(),
  manualByProjectActivity: new Map(),
  weightManualByProjectActivity: new Map(),
  manualActivities: [],
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Fully-past intervals never change (the spec sanctions caching them), so we
  // memoize them briefly; the current month and anything touching today skip the
  // cache and always recompute. TTL bounds staleness from retroactive edits.
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private static readonly CACHE_MAX_ENTRIES = 64;

  async getProductivityReport(
    resolved: ResolvedReportPeriod,
  ): Promise<ProductivityReportResponse> {
    const cacheable = isPastInterval(resolved);
    const cacheKey = `${resolved.fromDay}|${resolved.toDay}`;

    if (cacheable) {
      const hit = this.cache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.value;
      }
    }

    const [projectRows, activityRows] = await Promise.all([
      this.prisma.$queryRaw<ProjectAggregateRow[]>(
        buildProjectAggregateQuery(resolved.from, resolved.toExclusive),
      ),
      this.prisma.$queryRaw<ActivityAggregateRow[]>(
        buildActivityAggregateQuery(resolved.from, resolved.toExclusive),
      ),
    ]);

    const response = shapeProductivityReport(
      resolved.period,
      resolved.fromDay,
      resolved.toDay,
      projectRows,
      activityRows,
    );

    if (cacheable) {
      this.storeInCache(cacheKey, response);
    }
    return response;
  }

  /** The whole life of one project, read across activities and people. */
  async getProjectReport(projectId: string): Promise<ProjectReportResponse> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        denumireLucrare: true,
        status: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        weight: true,
        estimatedHours: true,
        company: { select: { name: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [entries, assemblyIndex] = await Promise.all([
      this.prisma.$queryRaw<ProjectReportEntrySqlRow[]>(
        buildProjectReportEntriesQuery(projectId),
      ),
      this.loadAssemblyIndex([projectId]),
    ]);

    return shapeProjectReport(
      { ...project, companyName: project.company.name },
      entries,
      assemblyIndex,
    );
  }

  /** Hours burned against pieces finished, over the projects still in the shop. */
  async getActiveProjectsReport(): Promise<ActiveProjectsReportResponse> {
    const projectRows =
      await this.prisma.$queryRaw<ActiveProjectSqlRow[]>(buildActiveProjectsQuery());

    if (projectRows.length === 0) {
      return { rows: [], generatedAt: new Date().toISOString() };
    }

    const projectIds = projectRows.map((row) => row.projectId);
    const [activityRows, assemblyIndex] = await Promise.all([
      this.prisma.$queryRaw<ActiveProjectActivitySqlRow[]>(
        buildActiveProjectActivitiesQuery(projectIds),
      ),
      this.loadAssemblyIndex(projectIds),
    ]);

    return shapeActiveProjectsReport(projectRows, activityRows, assemblyIndex);
  }

  /** Hours per ton by activity, from the projects already delivered. */
  async getActivityNorms(window: ResolvedNormsWindow): Promise<ActivityNormsResponse> {
    const [projectRows, activityRows] = await Promise.all([
      this.prisma.$queryRaw<NormProjectSqlRow[]>(
        buildNormProjectsQuery(window.from, window.toExclusive),
      ),
      this.prisma.$queryRaw<NormActivitySqlRow[]>(
        buildNormActivitiesQuery(window.from, window.toExclusive),
      ),
    ]);

    return shapeActivityNorms(window, projectRows, activityRows);
  }

  /**
   * Pieces and kilograms closed per project and activity. Reuses the pontaj
   * summary's queries: assembly progress has one definition, and a second copy
   * here would be a second definition waiting to disagree with it.
   */
  private async loadAssemblyIndex(
    projectIds: string[],
  ): Promise<ProjectAssemblyProgressIndex> {
    if (projectIds.length === 0) {
      return EMPTY_ASSEMBLY_INDEX;
    }

    const [doneRows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<ProjectSummaryAssemblyDoneSqlRow[]>(
        buildProjectSummaryAssemblyDoneQuery(projectIds),
      ),
      this.prisma.$queryRaw<ProjectSummaryAssemblyTotalSqlRow[]>(
        buildProjectSummaryAssemblyTotalQuery(projectIds),
      ),
    ]);

    return indexProjectAssemblyProgress(doneRows, totalRows);
  }

  private storeInCache(key: string, value: ProductivityReportResponse): void {
    if (this.cache.size >= ReportsService.CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, {
      expiresAt: Date.now() + ReportsService.CACHE_TTL_MS,
      value,
    });
  }
}
