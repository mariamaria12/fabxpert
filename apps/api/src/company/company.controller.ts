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

@Controller('companies')
@Roles('ADMIN')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.companyService.findAll(parsePagination(query));
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
