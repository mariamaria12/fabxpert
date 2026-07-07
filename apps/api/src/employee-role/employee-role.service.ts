import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeRole, Prisma } from '@prisma/client';
import type {
  CreateEmployeeRoleInput,
  EmployeeRoleDto,
  UpdateEmployeeRoleInput,
} from '@fabxpert/shared/dto/employee-role.dto';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { createOrReviveSoftDeletedByName } from '../common/prisma/lookup-revive-create.util';
import { PrismaService } from '../prisma/prisma.service';

function toEmployeeRoleDto(role: EmployeeRole): EmployeeRoleDto {
  return {
    id: role.id,
    name: role.name,
    isActive: role.isActive,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

@Injectable()
export class EmployeeRoleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userRole: string, includeInactive: boolean): Promise<EmployeeRoleDto[]> {
    const showInactive = userRole === 'ADMIN' && includeInactive;

    const rows = await this.prisma.employeeRole.findMany({
      where: {
        ...notDeleted(),
        ...(showInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return rows.map(toEmployeeRoleDto);
  }

  async findOne(id: string): Promise<EmployeeRoleDto> {
    const role = await this.prisma.employeeRole.findFirst({
      where: { id, ...notDeleted() },
    });
    if (!role) {
      throw new NotFoundException(`Employee role with id ${id} not found`);
    }
    return toEmployeeRoleDto(role);
  }

  async create(input: CreateEmployeeRoleInput): Promise<EmployeeRoleDto> {
    const role = await createOrReviveSoftDeletedByName(input.name, {
      findByName: (name) => this.prisma.employeeRole.findFirst({ where: { name } }),
      conflictMessage: 'An employee role with this name already exists',
      revive: (existing) =>
        this.prisma.employeeRole.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            isActive: input.isActive ?? true,
          },
        }),
      create: () => this.prisma.employeeRole.create({ data: input }),
      onUniqueViolation: (error) => this.handleUniqueViolation(error),
    });

    return toEmployeeRoleDto(role);
  }

  async update(id: string, input: UpdateEmployeeRoleInput): Promise<EmployeeRoleDto> {
    await this.findOne(id);

    try {
      const role = await this.prisma.employeeRole.update({
        where: { id },
        data: input,
      });
      return toEmployeeRoleDto(role);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.employeeRole.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private handleUniqueViolation(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [];

      if (fields.includes('name')) {
        throw new ConflictException('An employee role with this name already exists');
      }
    }

    throw error;
  }
}
