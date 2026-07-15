import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Company, Prisma } from '@prisma/client';
import {
  importCompanyRowSchema,
  type CompanyDto,
  type CompanyImportRejectedRow,
  type CompanyImportResult,
  type CompanyListSortBy,
  type CreateCompanyInput,
  type ImportCompanyRow,
  type UpdateCompanyInput,
} from '@fabxpert/shared/dto/company.dto';
import { parseCompanyImportRows } from '@fabxpert/shared/companyImport';
import type { SortOrder } from '@fabxpert/shared/dto/project.dto';
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

function buildCompanyOrderBy(
  sortBy?: CompanyListSortBy,
  sortOrder: SortOrder = 'asc',
): Prisma.CompanyOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'createdAt':
      return [{ createdAt: sortOrder }, { id: 'asc' }];
    case 'name':
    default:
      return [{ name: sortOrder }, { id: 'asc' }];
  }
}

function rowToCompanyData(row: ImportCompanyRow): CreateCompanyInput {
  return {
    name: row.name,
    taxCode: row.taxCode,
    tradeRegistryNumber: row.tradeRegistryNumber,
    registeredAddress: row.registeredAddress,
    phone: row.phone,
    deliveryAddress: row.deliveryAddress,
    legalRepresentative: row.legalRepresentative,
    email: row.email,
    contactPerson: row.contactPerson,
    contactPersonPhone: row.contactPersonPhone,
  };
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationParams,
    search?: string,
    sortBy?: CompanyListSortBy,
    sortOrder: SortOrder = 'asc',
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
        orderBy: buildCompanyOrderBy(sortBy, sortOrder),
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

  async importCompaniesFromTsv(tsv: string): Promise<CompanyImportResult> {
    const parsedRows = parseCompanyImportRows(tsv);
    const validation = importCompanyRowSchema.array().min(1).safeParse(parsedRows);
    if (!validation.success) {
      throw new BadRequestException('No valid company rows found');
    }

    return this.importCompanies(validation.data);
  }

  /**
   * Bulk import with upsert keyed by exact trimmed company name (case- and diacritic-sensitive).
   * Multiple rows may share the same taxCode — each distinct name is a separate company.
   */
  async importCompanies(rows: ImportCompanyRow[]): Promise<CompanyImportResult> {
    let created = 0;
    let updated = 0;
    const rejected: CompanyImportRejectedRow[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 1;
      const row = rows[index];
      const name = row.name.trim();

      const matches = await this.prisma.company.findMany({
        where: { name },
        orderBy: { id: 'asc' },
      });
      const activeMatches = matches.filter((company) => company.deletedAt === null);
      const deletedMatches = matches.filter((company) => company.deletedAt !== null);

      if (deletedMatches.length > 0 && activeMatches.length === 0) {
        rejected.push({
          row: rowNumber,
          name,
          reason: 'A company with this name was previously deleted',
        });
        continue;
      }

      if (activeMatches.length > 1) {
        rejected.push({
          row: rowNumber,
          name,
          reason: 'Multiple active companies share this name',
        });
        continue;
      }

      const data = rowToCompanyData(row);

      if (activeMatches.length === 1) {
        await this.prisma.company.update({
          where: { id: activeMatches[0].id },
          data,
        });
        updated += 1;
        continue;
      }

      await this.prisma.company.create({ data });
      created += 1;
    }

    return { created, updated, rejected };
  }
}
