import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  BadRequestException,
} from '@nestjs/common';
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@fabxpert/shared/dto/project.dto';
import {
  reorderPinnedProjectsSchema,
  type ReorderPinnedProjectsInput,
} from '@fabxpert/shared/dto/project-reorder.dto';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAvailabilityEventsService } from './project-availability-events.service';
import { ProjectService } from './project.service';

const idParamSchema = z.string().trim().min(1);
const statusGroupSchema = z.enum(['in_progress', 'completed']);
const statusSchema = z.enum([
  'CIORNA',
  'IN_OFERTARE',
  'CASTIGAT',
  'IN_PROIECTARE',
  'IN_PRODUCTIE',
  'PREGATIT_LIVRARE',
  'LIVRAT',
  'FINALIZAT',
  'SUSPENDAT',
  'ANULAT',
]);
const roleIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const sortBySchema = z.enum(['name', 'code', 'company', 'startDate', 'dueDate']);
const sortOrderSchema = z.enum(['asc', 'desc']);

function parseVisibleForQuery(raw: string | undefined): {
  everyone: boolean;
  roleIds: string[];
} | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }

  const parts = [
    ...new Set(
      raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  ];

  let everyone = false;
  const roleIds: string[] = [];

  for (const part of parts) {
    if (part === 'everyone') {
      everyone = true;
      continue;
    }

    const parsed = roleIdSchema.safeParse(part);
    if (!parsed.success) {
      throw new BadRequestException('Invalid visibleFor');
    }
    roleIds.push(parsed.data);
  }

  if (!everyone && roleIds.length === 0) {
    return undefined;
  }

  return { everyone, roleIds };
}

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
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  findAvailable(@CurrentUser() user: AuthenticatedUser) {
    return this.projectService.findAvailable(user);
  }

  @Get()
  findAll(@Query() query: Record<string, string>) {
    const search = query.search?.trim() || undefined;
    let statusGroup: z.infer<typeof statusGroupSchema> | undefined;
    let statuses: z.infer<typeof statusSchema>[] | undefined;

    if (query.status !== undefined && query.status !== '') {
      const parts = query.status
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      const uniqueParts = [...new Set(parts)];
      const parsedStatuses: z.infer<typeof statusSchema>[] = [];

      for (const part of uniqueParts) {
        const parsed = statusSchema.safeParse(part);
        if (!parsed.success) {
          throw new BadRequestException('Invalid status');
        }
        parsedStatuses.push(parsed.data);
      }

      if (parsedStatuses.length > 0) {
        statuses = parsedStatuses;
      }
    }

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

    const compact = query.compact === 'true' || query.compact === '1';
    const visibleFor = parseVisibleForQuery(query.visibleFor);

    let readyForExecution: boolean | undefined;
    if (query.readyForExecution !== undefined && query.readyForExecution !== '') {
      if (query.readyForExecution === 'true' || query.readyForExecution === '1') {
        readyForExecution = true;
      } else if (query.readyForExecution === 'false' || query.readyForExecution === '0') {
        readyForExecution = false;
      } else {
        throw new BadRequestException('Invalid readyForExecution');
      }
    }

    return this.projectService.findAll(
      parsePagination(query),
      search,
      statusGroup,
      sortBy,
      sortOrder,
      compact,
      statuses,
      visibleFor,
      readyForExecution,
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

  @Patch('pinned-order')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderPinned(
    @Body(new ZodValidationPipe(reorderPinnedProjectsSchema))
    input: ReorderPinnedProjectsInput,
  ) {
    await this.projectService.reorderPinnedProjects(input.columns);
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
