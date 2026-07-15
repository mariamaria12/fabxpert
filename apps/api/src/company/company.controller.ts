import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  createCompanySchema,
  updateCompanySchema,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from '@fabxpert/shared/dto/company.dto';
import { z } from 'zod';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyService } from './company.service';

const idParamSchema = z.string().trim().min(1);
const sortBySchema = z.enum(['name', 'createdAt']);
const sortOrderSchema = z.enum(['asc', 'desc']);

@Controller('companies')
@Roles('ADMIN')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    const search = query.search?.trim() || undefined;

    let sortBy: z.infer<typeof sortBySchema> | undefined;
    if (query.sortBy !== undefined && query.sortBy !== '') {
      const parsed = sortBySchema.safeParse(query.sortBy);
      if (!parsed.success) {
        throw new BadRequestException('Invalid sortBy');
      }
      sortBy = parsed.data;
    }

    let sortOrder: z.infer<typeof sortOrderSchema> = 'asc';
    if (query.sortOrder !== undefined && query.sortOrder !== '') {
      const parsed = sortOrderSchema.safeParse(query.sortOrder);
      if (!parsed.success) {
        throw new BadRequestException('Invalid sortOrder');
      }
      sortOrder = parsed.data;
    }

    return this.companyService.findAll(parsePagination(query), search, sortBy, sortOrder);
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.companyService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createCompanySchema)) input: CreateCompanyInput,
  ) {
    return this.companyService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateCompanySchema)) input: UpdateCompanyInput,
  ) {
    return this.companyService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    await this.companyService.softDelete(id);
  }
}
