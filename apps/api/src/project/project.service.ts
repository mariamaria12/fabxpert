import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Project } from '@prisma/client';
import type {
  CreateProjectInput,
  ProjectDto,
  UpdateProjectInput,
} from '@fabxpert/shared/dto/project.dto';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';

function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    status: project.status,
    dueDate: project.dueDate?.toISOString() ?? null,
    readyForExecution: project.readyForExecution,
    color: project.color,
    companyId: project.companyId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationParams): Promise<PaginatedResponse<ProjectDto>> {
    const { page, pageSize } = pagination;
    const where = { ...notDeleted() };

    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
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
    });
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    return toProjectDto(project);
  }

  async create(input: CreateProjectInput): Promise<ProjectDto> {
    await this.assertCompanyExists(input.companyId);

    try {
      const project = await this.prisma.project.create({ data: input });
      return toProjectDto(project);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async update(id: string, input: UpdateProjectInput): Promise<ProjectDto> {
    await this.findOne(id);

    if (input.companyId !== undefined) {
      await this.assertCompanyExists(input.companyId);
    }

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: input,
      });
      return toProjectDto(project);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
