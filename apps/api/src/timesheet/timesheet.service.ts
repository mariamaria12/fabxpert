import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateTimesheetInput,
  PinnedProjectsSummaryResponse,
  ProjectSummaryResponse,
  PersonSummaryResponse,
  DashboardMetricsResponse,
  TimesheetDto,
  TimesheetListSortBy,
  UpdateTimesheetInput,
} from '@fabxpert/shared/dto/timesheet.dto';
import type { SortOrder } from '@fabxpert/shared/dto/project.dto';
import { parseWorkDateString, todayWorkDate } from '@fabxpert/shared/workDate';
import type { ResolvedSummaryPeriod } from './timesheet-summary-period.util';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted, visibleTimesheetWhere } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';
import { TimesheetEventsService } from './timesheet-events.service';
import {
  createdTimesheetEvent,
  deletedTimesheetEvent,
  updatedTimesheetEvent,
} from './timesheet-events.util';
import {
  buildProjectSummaryQuery,
  shapePinnedProjectsSummary,
  shapeProjectSummary,
  type ProjectSummarySqlRow,
} from './timesheet-project-summary.util';
import {
  buildPersonSummaryQuery,
  shapePersonSummary,
  type PersonSummarySqlRow,
} from './timesheet-person-summary.util';
import { queryDashboardMetrics } from './timesheet-dashboard-metrics.util';
import {
  buildTimesheetExportFilename,
  buildTimesheetExportXlsx,
} from './timesheet-export-xlsx.util';

const timesheetInclude = {
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      company: {
        select: {
          name: true,
        },
      },
    },
  },
  activity: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
} satisfies Prisma.TimesheetInclude;

type TimesheetWithRelations = Prisma.TimesheetGetPayload<{
  include: typeof timesheetInclude;
}>;

export interface TimesheetListFilters {
  personId?: string;
  projectId?: string;
  search?: string;
  workDateFrom?: Date;
  workDateTo?: Date;
  createdAtFrom?: Date;
  createdAtTo?: Date;
}

function buildPersonSearchWhere(search: string): Prisma.PersonWhereInput {
  const tokens = search
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return {};
  }

  return {
    AND: tokens.map((token) => ({
      OR: [
        { firstName: { contains: token, mode: 'insensitive' } },
        { lastName: { contains: token, mode: 'insensitive' } },
      ],
    })),
  };
}

function toTimesheetDto(timesheet: TimesheetWithRelations): TimesheetDto {
  return {
    id: timesheet.id,
    workDate: timesheet.workDate.toISOString(),
    durationMinutes: timesheet.durationMinutes,
    notes: timesheet.notes,
    personId: timesheet.personId,
    userId: timesheet.userId,
    projectId: timesheet.projectId,
    activityId: timesheet.activityId,
    person: timesheet.person,
    project: timesheet.project,
    activity: timesheet.activity,
    createdAt: timesheet.createdAt.toISOString(),
    updatedAt: timesheet.updatedAt.toISOString(),
  };
}

function buildTimesheetOrderBy(
  sortBy?: TimesheetListSortBy,
  sortOrder: SortOrder = 'asc',
  orderByCreatedAt = false,
): Prisma.TimesheetOrderByWithRelationInput[] {
  const tiebreaker: Prisma.TimesheetOrderByWithRelationInput = { id: 'asc' };

  if (orderByCreatedAt && !sortBy) {
    return [{ createdAt: 'desc' }];
  }

  switch (sortBy) {
    case 'person':
      return [
        { person: { firstName: sortOrder } },
        { person: { lastName: sortOrder } },
        tiebreaker,
      ];
    case 'project':
      return [{ project: { name: sortOrder } }, tiebreaker];
    case 'activity':
      return [{ activity: { name: sortOrder } }, tiebreaker];
    case 'date':
      return [{ workDate: sortOrder }, { createdAt: 'desc' }, tiebreaker];
    default:
      return [{ workDate: 'desc' }, { createdAt: 'desc' }, tiebreaker];
  }
}

@Injectable()
export class TimesheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timesheetEvents: TimesheetEventsService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateTimesheetInput,
  ): Promise<TimesheetDto> {
    this.rejectPersonIdFromEmployee(actor.role, input.personId);

    const personId = await this.resolveManualCreatePersonId(actor, input.personId);
    await this.assertProjectExists(input.projectId, actor.role === 'EMPLOYEE');
    if (input.activityId !== undefined) {
      await this.assertActivityExists(input.activityId);
    }

    const workDate = input.workDate
      ? parseWorkDateString(input.workDate)
      : todayWorkDate();

    const timesheet = await this.prisma.timesheet.create({
      data: {
        personId,
        userId: actor.id,
        projectId: input.projectId,
        activityId: input.activityId,
        notes: input.notes,
        workDate,
        durationMinutes: input.durationMinutes,
      },
      include: timesheetInclude,
    });

    const dto = toTimesheetDto(timesheet);
    this.timesheetEvents.emit(createdTimesheetEvent(dto.id, dto.person));
    return dto;
  }

  async findAll(
    pagination: PaginationParams,
    filters: TimesheetListFilters,
    sortBy?: TimesheetListSortBy,
    sortOrder: SortOrder = 'asc',
  ): Promise<PaginatedResponse<TimesheetDto>> {
    const { page, pageSize } = pagination;
    const where = this.buildListWhere(filters);

    const orderByCreatedAt =
      filters.createdAtFrom !== undefined || filters.createdAtTo !== undefined;

    const [total, rows] = await Promise.all([
      this.prisma.timesheet.count({ where }),
      this.prisma.timesheet.findMany({
        where,
        include: timesheetInclude,
        orderBy: buildTimesheetOrderBy(sortBy, sortOrder, orderByCreatedAt),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toTimesheetDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  async getProjectSummary(resolved: ResolvedSummaryPeriod): Promise<ProjectSummaryResponse> {
    const rows = await this.prisma.$queryRaw<ProjectSummarySqlRow[]>(
      buildProjectSummaryQuery(resolved.from, resolved.to),
    );
    return shapeProjectSummary(rows, resolved.period);
  }

  async getPinnedProjectsSummary(): Promise<PinnedProjectsSummaryResponse> {
    const rows = await this.prisma.$queryRaw<ProjectSummarySqlRow[]>(
      buildProjectSummaryQuery({
        pinnedOnly: true,
        includeZeroEntryProjects: true,
      }),
    );
    return shapePinnedProjectsSummary(rows);
  }

  async getPersonSummary(resolved: ResolvedSummaryPeriod): Promise<PersonSummaryResponse> {
    const rows = await this.prisma.$queryRaw<PersonSummarySqlRow[]>(
      buildPersonSummaryQuery(resolved.from, resolved.to),
    );
    return shapePersonSummary(rows, resolved.period);
  }

  async getDashboardMetrics(): Promise<DashboardMetricsResponse> {
    return queryDashboardMetrics(this.prisma);
  }

  /**
   * Flat export listing: workDate asc, person name, project name.
   * Used by GET /timesheets/export.xlsx (payroll format).
   */
  async exportXlsx(
    resolved: ResolvedSummaryPeriod,
    filters: Pick<TimesheetListFilters, 'personId' | 'projectId'>,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const where = this.buildListWhere({
      ...filters,
      workDateFrom: resolved.from ?? undefined,
      workDateTo: resolved.to ?? undefined,
    });

    const rows = await this.prisma.timesheet.findMany({
      where,
      include: timesheetInclude,
      orderBy: [
        { workDate: 'asc' },
        { person: { lastName: 'asc' } },
        { person: { firstName: 'asc' } },
        { project: { name: 'asc' } },
      ],
    });

    const buffer = await buildTimesheetExportXlsx(rows);
    return {
      buffer,
      filename: buildTimesheetExportFilename(resolved),
    };
  }

  async findMine(
    actor: AuthenticatedUser,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<TimesheetDto>> {
    const personId = await this.resolveEmployeePersonId(actor.id);

    const { page, pageSize } = pagination;
    const where = { personId, ...visibleTimesheetWhere() };

    const [total, rows] = await Promise.all([
      this.prisma.timesheet.count({ where }),
      this.prisma.timesheet.findMany({
        where,
        include: timesheetInclude,
        orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toTimesheetDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<TimesheetDto> {
    const timesheet = await this.getTimesheetOrThrow(id);

    if (actor.role === 'EMPLOYEE') {
      const personId = await this.resolveEmployeePersonId(actor.id);
      if (timesheet.personId !== personId) {
        throw new ForbiddenException('You do not have access to this timesheet');
      }
    }

    return toTimesheetDto(timesheet);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateTimesheetInput,
  ): Promise<TimesheetDto> {
    this.rejectPersonIdFromEmployee(actor.role, input.personId);

    const existing = await this.getTimesheetOrThrow(id);

    if (actor.role === 'EMPLOYEE') {
      const personId = await this.resolveEmployeePersonId(actor.id);
      if (existing.personId !== personId) {
        throw new ForbiddenException('You do not have access to this timesheet');
      }
    }

    if (input.personId !== undefined && actor.role === 'ADMIN') {
      await this.assertPersonExists(input.personId);
    }

    const nextProjectId = input.projectId ?? existing.projectId;
    const nextActivityId =
      input.activityId !== undefined ? input.activityId : existing.activityId;

    await this.assertProjectExists(
      nextProjectId,
      actor.role === 'EMPLOYEE',
    );
    if (nextActivityId !== null) {
      await this.assertActivityExists(nextActivityId);
    }

    const timesheet = await this.prisma.timesheet.update({
      where: { id },
      data: {
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.activityId !== undefined ? { activityId: input.activityId } : {}),
        ...(input.workDate !== undefined
          ? { workDate: parseWorkDateString(input.workDate) }
          : {}),
        ...(input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(actor.role === 'ADMIN' && input.personId !== undefined
          ? { personId: input.personId }
          : {}),
      },
      include: timesheetInclude,
    });

    const dto = toTimesheetDto(timesheet);
    this.timesheetEvents.emit(updatedTimesheetEvent(dto.id, dto.person));
    return dto;
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.getTimesheetOrThrow(id);

    if (actor.role === 'EMPLOYEE') {
      const personId = await this.resolveEmployeePersonId(actor.id);
      if (existing.personId !== personId) {
        throw new ForbiddenException('You do not have access to this timesheet');
      }
    }

    await this.prisma.timesheet.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.timesheetEvents.emit(deletedTimesheetEvent(id, existing.person));
  }

  private buildListWhere(filters: TimesheetListFilters): Prisma.TimesheetWhereInput {
    return {
      ...visibleTimesheetWhere(),
      ...(filters.personId ? { personId: filters.personId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.search
        ? {
            person: {
              ...notDeleted(),
              ...buildPersonSearchWhere(filters.search),
            },
          }
        : {}),
      ...(filters.workDateFrom !== undefined || filters.workDateTo !== undefined
        ? {
            workDate: {
              ...(filters.workDateFrom !== undefined
                ? { gte: filters.workDateFrom }
                : {}),
              ...(filters.workDateTo !== undefined ? { lt: filters.workDateTo } : {}),
            },
          }
        : {}),
      ...(filters.createdAtFrom !== undefined || filters.createdAtTo !== undefined
        ? {
            createdAt: {
              ...(filters.createdAtFrom !== undefined
                ? { gte: filters.createdAtFrom }
                : {}),
              ...(filters.createdAtTo !== undefined ? { lt: filters.createdAtTo } : {}),
            },
          }
        : {}),
    };
  }

  private rejectPersonIdFromEmployee(role: string, personId?: string): void {
    if (role === 'EMPLOYEE' && personId !== undefined) {
      throw new BadRequestException('personId must not be supplied by employees');
    }
  }

  private async resolveManualCreatePersonId(
    actor: AuthenticatedUser,
    explicitPersonId?: string,
  ): Promise<string> {
    if (actor.role === 'EMPLOYEE') {
      return this.resolveEmployeePersonId(actor.id);
    }

    if (explicitPersonId === undefined) {
      throw new BadRequestException(
        'personId is required when creating a timesheet on behalf of someone',
      );
    }

    await this.assertPersonExists(explicitPersonId);
    return explicitPersonId;
  }

  private async resolveEmployeePersonId(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...notDeleted() },
      select: {
        personId: true,
        person: {
          select: { deletedAt: true },
        },
      },
    });

    if (!user || user.person.deletedAt !== null) {
      throw new BadRequestException('Your user account is not linked to a person');
    }

    return user.personId;
  }

  private async getTimesheetOrThrow(id: string): Promise<TimesheetWithRelations> {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: { id, ...visibleTimesheetWhere() },
      include: timesheetInclude,
    });

    if (!timesheet) {
      throw new NotFoundException(`Timesheet with id ${id} not found`);
    }

    return timesheet;
  }

  private async assertProjectExists(
    projectId: string,
    enforceReadyForExecution: boolean,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...notDeleted() },
    });

    if (!project) {
      throw new BadRequestException('projectId does not reference an existing project');
    }

    if (enforceReadyForExecution && !project.readyForExecution) {
      throw new BadRequestException(
        'This project is not available for employee time logging',
      );
    }
  }

  private async assertActivityExists(activityId: string): Promise<void> {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, ...notDeleted(), isActive: true },
    });

    if (!activity) {
      throw new BadRequestException(
        'activityId does not reference an existing active activity',
      );
    }
  }

  private async assertPersonExists(personId: string): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, ...notDeleted() },
    });

    if (!person) {
      throw new BadRequestException('personId does not reference an existing person');
    }
  }
}
