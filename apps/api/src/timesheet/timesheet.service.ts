import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateTimesheetInput,
  ProjectSummaryResponse,
  PersonSummaryResponse,
  DashboardMetricsResponse,
  StartTimesheetBodyInput,
  StopTimesheetInput,
  TimesheetDto,
  UpdateTimesheetInput,
} from '@fabxpert/shared/dto/timesheet.dto';
import type { ResolvedSummaryPeriod } from './timesheet-summary-period.util';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';
import { TimesheetEventsService } from './timesheet-events.service';
import {
  createdTimesheetEvent,
  deletedTimesheetEvent,
  updatedTimesheetEvent,
} from './timesheet-events.util';
import {
  buildProjectSummaryQuery,
  shapeProjectSummary,
  type ProjectSummarySqlRow,
} from './timesheet-project-summary.util';
import {
  buildPersonSummaryQuery,
  shapePersonSummary,
  type PersonSummarySqlRow,
} from './timesheet-person-summary.util';
import { queryDashboardMetrics } from './timesheet-dashboard-metrics.util';

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
  startTimeFrom?: Date;
  startTimeTo?: Date;
  createdAtFrom?: Date;
  createdAtTo?: Date;
}

function toTimesheetDto(timesheet: TimesheetWithRelations): TimesheetDto {
  return {
    id: timesheet.id,
    startTime: timesheet.startTime.toISOString(),
    endTime: timesheet.endTime?.toISOString() ?? null,
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

@Injectable()
export class TimesheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timesheetEvents: TimesheetEventsService,
  ) {}

  async start(
    actor: AuthenticatedUser,
    input: StartTimesheetBodyInput,
  ): Promise<TimesheetDto> {
    this.rejectPersonIdFromEmployee(actor.role, input.personId);

    const personId = await this.resolveTargetPersonId(actor, input.personId);
    await this.assertProjectExists(input.projectId, actor.role === 'EMPLOYEE');
    if (input.activityId !== undefined) {
      await this.assertActivityExists(input.activityId);
    }

    const now = new Date();

    const timesheet = await this.prisma.$transaction(async (tx) => {
      await this.assertNoOpenTimesheetInTx(tx, personId);

      return tx.timesheet.create({
        data: {
          personId,
          userId: actor.id,
          projectId: input.projectId,
          activityId: input.activityId,
          notes: input.notes,
          startTime: now,
        },
        include: timesheetInclude,
      });
    });

    const dto = toTimesheetDto(timesheet);
    this.timesheetEvents.emit(createdTimesheetEvent(dto.id, dto.person));
    return dto;
  }

  async stop(actor: AuthenticatedUser, input: StopTimesheetInput): Promise<TimesheetDto> {
    this.rejectPersonIdFromEmployee(actor.role, input.personId);

    const personId = await this.resolveTargetPersonId(actor, input.personId);
    const open = await this.findOpenTimesheet(personId);

    if (!open) {
      throw new NotFoundException('No open timesheet to stop');
    }

    const timesheet = await this.prisma.timesheet.update({
      where: { id: open.id },
      data: { endTime: new Date() },
      include: timesheetInclude,
    });

    const dto = toTimesheetDto(timesheet);
    this.timesheetEvents.emit(updatedTimesheetEvent(dto.id, dto.person));
    return dto;
  }

  async createManual(
    actor: AuthenticatedUser,
    input: CreateTimesheetInput,
  ): Promise<TimesheetDto> {
    this.rejectPersonIdFromEmployee(actor.role, input.personId);

    const personId = await this.resolveManualCreatePersonId(actor, input.personId);
    await this.assertProjectExists(input.projectId, actor.role === 'EMPLOYEE');
    if (input.activityId !== undefined) {
      await this.assertActivityExists(input.activityId);
    }

    this.assertValidInterval(input.startTime, input.endTime);

    const timesheet = await this.prisma.$transaction(async (tx) => {
      if (input.endTime === undefined) {
        await this.assertNoOpenTimesheetInTx(tx, personId);
      }

      return tx.timesheet.create({
        data: {
          personId,
          userId: actor.id,
          projectId: input.projectId,
          activityId: input.activityId,
          notes: input.notes,
          startTime: input.startTime,
          endTime: input.endTime,
        },
        include: timesheetInclude,
      });
    });

    const dto = toTimesheetDto(timesheet);
    this.timesheetEvents.emit(createdTimesheetEvent(dto.id, dto.person));
    return dto;
  }

  async findAll(
    pagination: PaginationParams,
    filters: TimesheetListFilters,
  ): Promise<PaginatedResponse<TimesheetDto>> {
    const { page, pageSize } = pagination;
    const where: Prisma.TimesheetWhereInput = {
      ...notDeleted(),
      ...(filters.personId ? { personId: filters.personId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.startTimeFrom !== undefined || filters.startTimeTo !== undefined
        ? {
            startTime: {
              ...(filters.startTimeFrom !== undefined
                ? { gte: filters.startTimeFrom }
                : {}),
              ...(filters.startTimeTo !== undefined ? { lt: filters.startTimeTo } : {}),
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

    const orderByCreatedAt =
      filters.createdAtFrom !== undefined || filters.createdAtTo !== undefined;

    const [total, rows] = await Promise.all([
      this.prisma.timesheet.count({ where }),
      this.prisma.timesheet.findMany({
        where,
        include: timesheetInclude,
        orderBy: orderByCreatedAt ? { createdAt: 'desc' } : { startTime: 'desc' },
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

  async getPersonSummary(resolved: ResolvedSummaryPeriod): Promise<PersonSummaryResponse> {
    const rows = await this.prisma.$queryRaw<PersonSummarySqlRow[]>(
      buildPersonSummaryQuery(resolved.from, resolved.to),
    );
    return shapePersonSummary(rows, resolved.period);
  }

  async getDashboardMetrics(): Promise<DashboardMetricsResponse> {
    return queryDashboardMetrics(this.prisma);
  }

  async findMine(
    actor: AuthenticatedUser,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<TimesheetDto>> {
    const personId = await this.resolveEmployeePersonId(actor.id);

    const { page, pageSize } = pagination;
    const where = { personId, ...notDeleted() };

    const [total, rows] = await Promise.all([
      this.prisma.timesheet.count({ where }),
      this.prisma.timesheet.findMany({
        where,
        include: timesheetInclude,
        orderBy: { startTime: 'desc' },
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

    const nextPersonId =
      actor.role === 'ADMIN' && input.personId !== undefined
        ? input.personId
        : existing.personId;

    if (input.personId !== undefined && actor.role === 'ADMIN') {
      await this.assertPersonExists(input.personId);
    }

    const nextProjectId = input.projectId ?? existing.projectId;
    const nextActivityId =
      input.activityId !== undefined ? input.activityId : existing.activityId;
    const nextStartTime = input.startTime ?? existing.startTime;
    const nextEndTime = input.endTime !== undefined ? input.endTime : existing.endTime;

    await this.assertProjectExists(
      nextProjectId,
      actor.role === 'EMPLOYEE',
    );
    if (nextActivityId !== null) {
      await this.assertActivityExists(nextActivityId);
    }

    this.assertValidInterval(nextStartTime, nextEndTime);

    const timesheet = await this.prisma.$transaction(async (tx) => {
      if (nextEndTime === null) {
        await this.assertNoOpenTimesheetInTx(tx, nextPersonId, id);
      }

      return tx.timesheet.update({
        where: { id },
        data: {
          ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
          ...(input.activityId !== undefined ? { activityId: input.activityId } : {}),
          ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
          ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(actor.role === 'ADMIN' && input.personId !== undefined
            ? { personId: input.personId }
            : {}),
        },
        include: timesheetInclude,
      });
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

  private rejectPersonIdFromEmployee(role: string, personId?: string): void {
    if (role === 'EMPLOYEE' && personId !== undefined) {
      throw new BadRequestException('personId must not be supplied by employees');
    }
  }

  private async resolveTargetPersonId(
    actor: AuthenticatedUser,
    explicitPersonId?: string,
  ): Promise<string> {
    if (actor.role === 'EMPLOYEE') {
      return this.resolveEmployeePersonId(actor.id);
    }

    if (explicitPersonId !== undefined) {
      await this.assertPersonExists(explicitPersonId);
      return explicitPersonId;
    }

    return this.resolveEmployeePersonId(actor.id);
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
      where: { id, ...notDeleted() },
      include: timesheetInclude,
    });

    if (!timesheet) {
      throw new NotFoundException(`Timesheet with id ${id} not found`);
    }

    return timesheet;
  }

  private async findOpenTimesheet(personId: string) {
    return this.prisma.timesheet.findFirst({
      where: {
        personId,
        endTime: null,
        ...notDeleted(),
      },
    });
  }

  private async assertNoOpenTimesheetInTx(
    tx: Prisma.TransactionClient,
    personId: string,
    excludeId?: string,
  ): Promise<void> {
    const open = await tx.timesheet.findFirst({
      where: {
        personId,
        endTime: null,
        ...notDeleted(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (open) {
      throw new ConflictException('This person already has an open timesheet');
    }
  }

  private assertValidInterval(startTime: Date, endTime?: Date | null): void {
    if (endTime !== undefined && endTime !== null && endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }
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
