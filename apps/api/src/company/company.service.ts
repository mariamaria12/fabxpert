import type { Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Company } from '@prisma/client';
import type {
  CompanyDto,
  CreateCompanyInput,
  UpdateCompanyInput,
} from '@fabxpert/shared/dto/company.dto';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';

function toCompanyDto(company: Company): CompanyDto {
  return {
    id: company.id,
    name: company.name,
    taxCode: company.taxCode,
    tradeRegistryNumber: company.tradeRegistryNumber,
    registeredAddress: company.registeredAddress,
    phone: company.phone,
    deliveryAddress: company.deliveryAddress,
    legalRepresentative: company.legalRepresentative,
    email: company.email,
    contactPerson: company.contactPerson,
    contactPersonPhone: company.contactPersonPhone,
    color: company.color,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationParams,
    search?: string,
  ): Promise<PaginatedResponse<CompanyDto>> {
    const { page, pageSize } = pagination;
    const where: Prisma.CompanyWhereInput = { ...notDeleted() };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toCompanyDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(id: string): Promise<CompanyDto> {
    const company = await this.prisma.company.findFirst({
      where: { id, ...notDeleted() },
    });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    return toCompanyDto(company);
  }

  async create(input: CreateCompanyInput): Promise<CompanyDto> {
    const company = await this.prisma.company.create({ data: input });
    return toCompanyDto(company);
  }

  async update(id: string, input: UpdateCompanyInput): Promise<CompanyDto> {
    await this.findOne(id);
    const company = await this.prisma.company.update({
      where: { id },
      data: input,
    });
    return toCompanyDto(company);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
