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
  Sse,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@fabxpert/shared/dto/project.dto';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAvailabilityEventsService } from './project-availability-events.service';
import { ProjectService } from './project.service';

const idParamSchema = z.string().trim().min(1);
const statusGroupSchema = z.enum(['in_progress', 'completed']);
const sortBySchema = z.enum(['name', 'code', 'company', 'startDate', 'dueDate']);
const sortOrderSchema = z.enum(['asc', 'desc']);

@Controller('projects')
@Roles('ADMIN')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly availabilityEvents: ProjectAvailabilityEventsService,
  ) {}

  @Sse('available/stream')
  @Roles('ADMIN', 'EMPLOYEE')
  availableStream() {
    return this.availabilityEvents.subscribe();
  }

  @Get('available')
  @Roles('ADMIN', 'EMPLOYEE')
  findAvailable(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.projectService.findAvailable(req.user);
  }

  @Get()
  findAll(@Query() query: Record<string, string>) {
    const search = query.search?.trim() || undefined;
    let statusGroup: z.infer<typeof statusGroupSchema> | undefined;

    if (query.statusGroup !== undefined && query.statusGroup !== '') {
      const parsed = statusGroupSchema.safeParse(query.statusGroup);
      if (!parsed.success) {
        throw new BadRequestException('Invalid statusGroup');
      }
      statusGroup = parsed.data;
    }

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

    return this.projectService.findAll(
      parsePagination(query),
      search,
      statusGroup,
      sortBy,
      sortOrder,
    );
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.projectService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createProjectSchema)) input: CreateProjectInput,
  ) {
    return this.projectService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) input: UpdateProjectInput,
  ) {
    return this.projectService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    await this.projectService.softDelete(id);
  }
}
