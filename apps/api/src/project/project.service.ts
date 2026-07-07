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
} satisfies Prisma.ProjectInclude;

type ProjectWithCompany = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

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

function toProjectDto(project: ProjectWithCompany): ProjectDto {
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

  async findAvailable(): Promise<ProjectOptionDto[]> {
    return this.prisma.project.findMany({
      where: {
        ...notDeleted(),
        readyForExecution: true,
      },
      select: projectOptionSelect,
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateProjectInput): Promise<ProjectDto> {
    await this.assertCompanyExists(input.companyId);

    try {
      const project = await this.prisma.project.create({
        data: input,
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

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: input,
        include: projectInclude,
      });
      if (existing.readyForExecution !== project.readyForExecution) {
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

  private async assertCompanyExists(companyId: string): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, ...notDeleted() },
    });
    if (!company) {
      throw new BadRequestException('companyId does not reference an existing company');
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
