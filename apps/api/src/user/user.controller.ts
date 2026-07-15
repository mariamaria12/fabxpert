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
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@fabxpert/shared/dto/user.dto';
import { z } from 'zod';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserService } from './user.service';

const idParamSchema = z.string().trim().min(1);
const sortBySchema = z.enum(['name']);
const sortOrderSchema = z.enum(['asc', 'desc']);

@Controller('users')
@Roles('ADMIN')
export class UserController {
  constructor(private readonly userService: UserService) {}

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

    return this.userService.findAll(parsePagination(query), sortBy, sortOrder);
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createUserSchema)) input: CreateUserInput,
  ) {
    return this.userService.create(input);
  }

  @Patch(':id')
  update(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) input: UpdateUserInput,
  ) {
    return this.userService.update(id, input, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    await this.userService.softDelete(id, req.user.id);
  }
}
