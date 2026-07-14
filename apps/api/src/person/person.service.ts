import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreatePersonInput,
  PersonDto,
  UpdatePersonInput,
} from '@fabxpert/shared/dto/person.dto';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';

const personInclude = {
  employeeRole: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PersonInclude;

type PersonWithRole = Prisma.PersonGetPayload<{ include: typeof personInclude }>;

function toPersonDto(person: PersonWithRole): PersonDto {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone,
    employeeRoleId: person.employeeRoleId,
    employeeRole: person.employeeRole,
    annualLeaveDays: person.annualLeaveDays,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  };
}

@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationParams): Promise<PaginatedResponse<PersonDto>> {
    const { page, pageSize } = pagination;
    const where = { ...notDeleted() };

    const [total, rows] = await Promise.all([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        include: personInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toPersonDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(id: string): Promise<PersonDto> {
    const person = await this.prisma.person.findFirst({
      where: { id, ...notDeleted() },
      include: personInclude,
    });
    if (!person) {
      throw new NotFoundException(`Person with id ${id} not found`);
    }
    return toPersonDto(person);
  }

  async create(input: CreatePersonInput): Promise<PersonDto> {
    if (input.employeeRoleId !== undefined) {
      await this.assertEmployeeRoleExists(input.employeeRoleId);
    }

    const person = await this.prisma.person.create({
      data: input,
      include: personInclude,
    });
    return toPersonDto(person);
  }

  async update(id: string, input: UpdatePersonInput): Promise<PersonDto> {
    await this.findOne(id);

    if (input.employeeRoleId !== undefined) {
      await this.assertEmployeeRoleExists(input.employeeRoleId);
    }

    const person = await this.prisma.person.update({
      where: { id },
      data: input,
      include: personInclude,
    });
    return toPersonDto(person);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.person.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertEmployeeRoleExists(employeeRoleId: string): Promise<void> {
    const role = await this.prisma.employeeRole.findFirst({
      where: { id: employeeRoleId, ...notDeleted() },
    });
    if (!role) {
      throw new BadRequestException(
        'employeeRoleId does not reference an existing employee role',
      );
    }
  }
}
