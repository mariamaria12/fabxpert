import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import type {
  CreateProjectInput,
  ProjectDto,
  ProjectOptionDto,
  ProjectListSortBy,
  ProjectStatusGroup,
  SortOrder,
  UpdateProjectInput,
} from '@fabxpert/shared/dto/project.dto';
import { pickRandomProjectColor } from '@fabxpert/shared/projectColor';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAvailabilityEventsService } from './project-availability-events.service';

const projectOptionSelect = {
  id: true,
  name: true,
  code: true,
  color: true,
  company: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.ProjectSelect;

const projectCompanyInclude = {
  company: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProjectInclude;

const projectInclude = {
  ...projectCompanyInclude,
  visibleForRoles: {
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc' as const,
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;
type ProjectListRow = Prisma.ProjectGetPayload<{ include: typeof projectCompanyInclude }>;

const IN_PROGRESS_EXCLUDED_STATUSES: ProjectStatus[] = ['FINALIZAT', 'ANULAT'];

function applyStatusGroupFilter(
  where: Prisma.ProjectWhereInput,
  statusGroup?: ProjectStatusGroup,
): void {
  if (statusGroup === 'in_progress') {
    where.status = { notIn: IN_PROGRESS_EXCLUDED_STATUSES };
  } else if (statusGroup === 'completed') {
    where.status = 'FINALIZAT';
  }
}

function buildEmployeeRoleVisibilityWhere(
  employeeRoleId: string | null,
): Prisma.ProjectWhereInput {
  if (employeeRoleId) {
    return {
      OR: [
        { visibleForRoles: { none: {} } },
        { visibleForRoles: { some: { id: employeeRoleId } } },
      ],
    };
  }

  return {
    visibleForRoles: { none: {} },
  };
}

function roleIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function toProjectDto(project: ProjectWithRelations): ProjectDto;
function toProjectDto(project: ProjectListRow, compact: true): ProjectDto;
function toProjectDto(project: ProjectWithRelations | ProjectListRow, compact = false): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    status: project.status,
    startDate: project.startDate?.toISOString() ?? null,
    dueDate: project.dueDate?.toISOString() ?? null,
    readyForExecution: project.readyForExecution,
    isPinned: project.isPinned,
    indexPanou: project.indexPanou,
    color: project.color,
    companyId: project.companyId,
    company: project.company,
    visibleForRoles: compact ? [] : (project as ProjectWithRelations).visibleForRoles,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function buildProjectOrderBy(
  sortBy?: ProjectListSortBy,
  sortOrder: SortOrder = 'asc',
): Prisma.ProjectOrderByWithRelationInput[] {
  const tiebreaker: Prisma.ProjectOrderByWithRelationInput = { id: 'asc' };

  switch (sortBy) {
    case 'code':
      return [{ code: sortOrder }, tiebreaker];
    case 'company':
      return [{ company: { name: sortOrder } }, tiebreaker];
    case 'startDate':
      return [{ startDate: { sort: sortOrder, nulls: 'last' } }, tiebreaker];
    case 'dueDate':
      return [{ dueDate: { sort: sortOrder, nulls: 'last' } }, tiebreaker];
    case 'name':
    default:
      return [{ name: sortOrder }, tiebreaker];
  }
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityEvents: ProjectAvailabilityEventsService,
  ) {}

  async findAll(
    pagination: PaginationParams,
    search?: string,
    statusGroup?: ProjectStatusGroup,
    sortBy?: ProjectListSortBy,
    sortOrder: SortOrder = 'asc',
    compact = false,
  ): Promise<PaginatedResponse<ProjectDto>> {
    const { page, pageSize } = pagination;
    const where: Prisma.ProjectWhereInput = { ...notDeleted() };

    applyStatusGroupFilter(where, statusGroup);

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const include = compact ? projectCompanyInclude : projectInclude;
    const orderBy = buildProjectOrderBy(sortBy, sortOrder);

    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: compact
        ? (rows as ProjectListRow[]).map((row) => toProjectDto(row, true))
        : (rows as ProjectWithRelations[]).map(toProjectDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(id: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, ...notDeleted() },
      include: projectInclude,
    });
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    return toProjectDto(project);
  }

  async findAvailable(actor: AuthenticatedUser): Promise<ProjectOptionDto[]> {
    const employeeRoleId = await this.resolveEmployeeRoleId(actor.id);

    return this.prisma.project.findMany({
      where: {
        ...notDeleted(),
        readyForExecution: true,
        ...buildEmployeeRoleVisibilityWhere(employeeRoleId),
      },
      select: projectOptionSelect,
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateProjectInput): Promise<ProjectDto> {
    await this.assertCompanyExists(input.companyId);

    const { visibleForRoleIds, color, isPinned, ...scalarInput } = input;
    if (visibleForRoleIds !== undefined) {
      await this.assertVisibleForRoleIds(visibleForRoleIds);
    }

    try {
      const project = await this.prisma.project.create({
        data: {
          ...scalarInput,
          ...(isPinned !== undefined ? { isPinned } : {}),
          color: color ?? pickRandomProjectColor(),
          ...(isPinned ? { indexPanou: await this.getNextIndexPanou() } : {}),
          ...(visibleForRoleIds !== undefined
            ? {
                visibleForRoles: {
                  connect: visibleForRoleIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
        include: projectInclude,
      });
      if (project.readyForExecution) {
        this.availabilityEvents.emitChanged();
      }
      return toProjectDto(project);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async update(id: string, input: UpdateProjectInput): Promise<ProjectDto> {
    const existing = await this.findOne(id);

    if (input.companyId !== undefined) {
      await this.assertCompanyExists(input.companyId);
    }

    const { visibleForRoleIds, isPinned, ...scalarInput } = input;
    if (visibleForRoleIds !== undefined) {
      await this.assertVisibleForRoleIds(visibleForRoleIds);
    }

    const existingRoleIds = existing.visibleForRoles.map((role) => role.id);
    const rolesChanged =
      visibleForRoleIds !== undefined &&
      !roleIdsEqual(existingRoleIds, visibleForRoleIds);

    let indexPanou: number | null | undefined;
    if (isPinned === true && !existing.isPinned) {
      indexPanou = await this.getNextIndexPanou();
    } else if (isPinned === false && existing.isPinned) {
      indexPanou = null;
    }

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          ...scalarInput,
          ...(isPinned !== undefined ? { isPinned } : {}),
          ...(indexPanou !== undefined ? { indexPanou } : {}),
          ...(visibleForRoleIds !== undefined
            ? {
                visibleForRoles: {
                  set: visibleForRoleIds.map((roleId) => ({ id: roleId })),
                },
              }
            : {}),
        },
        include: projectInclude,
      });

      if (existing.readyForExecution !== project.readyForExecution) {
        this.availabilityEvents.emitChanged();
      } else if (
        rolesChanged &&
        (existing.readyForExecution || project.readyForExecution)
      ) {
        this.availabilityEvents.emitChanged();
      }

      return toProjectDto(project);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async reorderPinnedProjects(orderedIds: string[]): Promise<void> {
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new BadRequestException('orderedIds must not contain duplicates');
    }

    const pinned = await this.prisma.project.findMany({
      where: {
        id: { in: orderedIds },
        isPinned: true,
        ...notDeleted(),
      },
      select: { id: true },
    });

    if (pinned.length !== orderedIds.length) {
      throw new BadRequestException(
        'orderedIds must reference only existing pinned projects',
      );
    }

    await this.prisma.$transaction(
      orderedIds.map((projectId, index) =>
        this.prisma.project.update({
          where: { id: projectId },
          data: { indexPanou: index },
        }),
      ),
    );
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.findOne(id);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    if (existing.readyForExecution) {
      this.availabilityEvents.emitChanged();
    }
  }

  private async getNextIndexPanou(): Promise<number> {
    const result = await this.prisma.project.aggregate({
      where: {
        isPinned: true,
        ...notDeleted(),
      },
      _max: { indexPanou: true },
    });

    return (result._max.indexPanou ?? -1) + 1;
  }

  private async resolveEmployeeRoleId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        person: {
          select: { employeeRoleId: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.person.employeeRoleId;
  }

  private async assertCompanyExists(companyId: string): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, ...notDeleted() },
    });
    if (!company) {
      throw new BadRequestException('companyId does not reference an existing company');
    }
  }

  private async assertVisibleForRoleIds(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }

    if (new Set(roleIds).size !== roleIds.length) {
      throw new BadRequestException('visibleForRoleIds must not contain duplicates');
    }

    const found = await this.prisma.employeeRole.findMany({
      where: {
        id: { in: roleIds },
        ...notDeleted(),
      },
      select: { id: true },
    });

    if (found.length !== roleIds.length) {
      throw new BadRequestException(
        'One or more visibleForRoleIds do not reference existing employee roles',
      );
    }
  }

  private handleUniqueViolation(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A project with this code already exists');
    }
    throw error;
  }
}
