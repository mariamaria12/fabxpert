import {
  BadRequestException,
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
  createPersonSchema,
  updatePersonSchema,
  type CreatePersonInput,
  type UpdatePersonInput,
} from '@fabxpert/shared/dto/person.dto';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PersonService } from './person.service';

const idParamSchema = z.string().trim().min(1);
const sortBySchema = z.enum(['name']);
const sortOrderSchema = z.enum(['asc', 'desc']);

@Controller('persons')
@Roles('ADMIN')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
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

    return this.personService.findAll(parsePagination(query), sortBy, sortOrder);
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.personService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createPersonSchema)) input: CreatePersonInput,
  ) {
    return this.personService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updatePersonSchema)) input: UpdatePersonInput,
  ) {
    return this.personService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    await this.personService.softDelete(id);
  }
}
