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
  UpdateProjectInput,
} from '@fabxpert/shared/dto/project.dto';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import type { ProjectStatusGroup } from '@fabxpert/shared/dto/project.dto';
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
} satisfies Prisma.ProjectSelect;

const projectInclude = {
  company: {
    select: {
      id: true,
      name: true,
    },
  },
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

function toProjectDto(project: ProjectWithRelations): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    status: project.status,
    startDate: project.startDate?.toISOString() ?? null,
    dueDate: project.dueDate?.toISOString() ?? null,
    readyForExecution: project.readyForExecution,
    color: project.color,
    companyId: project.companyId,
    company: project.company,
    visibleForRoles: project.visibleForRoles,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
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

    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: projectInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toProjectDto),
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

    const { visibleForRoleIds, ...scalarInput } = input;
    if (visibleForRoleIds !== undefined) {
      await this.assertVisibleForRoleIds(visibleForRoleIds);
    }

    try {
      const project = await this.prisma.project.create({
        data: {
          ...scalarInput,
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

    const { visibleForRoleIds, ...scalarInput } = input;
    if (visibleForRoleIds !== undefined) {
      await this.assertVisibleForRoleIds(visibleForRoleIds);
    }

    const existingRoleIds = existing.visibleForRoles.map((role) => role.id);
    const rolesChanged =
      visibleForRoleIds !== undefined &&
      !roleIdsEqual(existingRoleIds, visibleForRoleIds);

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          ...scalarInput,
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
