import {
  Body,
  BadRequestException,
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
  Res,
  Sse,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createTimesheetSchema,
  updateTimesheetSchema,
  TIMESHEET_GROUP_SORT_BY_VALUES,
  type CreateTimesheetInput,
  type UpdateTimesheetInput,
} from '@fabxpert/shared/dto/timesheet.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TimesheetEventsService } from './timesheet-events.service';
import { TimesheetService, type TimesheetListFilters } from './timesheet.service';
import { parseSummaryPeriodQuery } from './timesheet-summary-period.util';

const idParamSchema = z.string().trim().min(1);
const sortBySchema = z.enum(['person', 'project', 'activity', 'date']);
const groupSortBySchema = z.enum(TIMESHEET_GROUP_SORT_BY_VALUES);
const sortOrderSchema = z.enum(['asc', 'desc']);

const uuidQuerySchema = z
  .string()
  .regex(
    /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const listFiltersSchema = z.object({
  personId: uuidQuerySchema.optional(),
  projectId: uuidQuerySchema.optional(),
  createdAtFrom: z.coerce.date().optional(),
  createdAtTo: z.coerce.date().optional(),
});

function parseListFilters(query: Record<string, string>) {
  const result = listFiltersSchema.safeParse({
    personId: query.personId,
    projectId: query.projectId,
    createdAtFrom: query.createdAtFrom,
    createdAtTo: query.createdAtTo,
  });

  const filters: TimesheetListFilters = result.success ? { ...result.data } : {};

  const search = query.search?.trim();
  if (search) {
    filters.search = search;
  }

  if (query.period) {
    const resolved = parseSummaryPeriodQuery(query);
    if (resolved.from && resolved.to) {
      filters.workDateFrom = resolved.from;
      filters.workDateTo = resolved.to;
    }
  }

  return filters;
}

function parseGroupSortParams(query: Record<string, string>) {
  let sortBy: z.infer<typeof groupSortBySchema> = 'date';
  if (query.sortBy !== undefined && query.sortBy !== '') {
    const parsed = groupSortBySchema.safeParse(query.sortBy);
    if (!parsed.success) {
      throw new BadRequestException('Invalid sortBy');
    }
    sortBy = parsed.data;
  }

  let sortOrder: z.infer<typeof sortOrderSchema> = 'desc';
  if (query.sortOrder !== undefined && query.sortOrder !== '') {
    const parsed = sortOrderSchema.safeParse(query.sortOrder);
    if (!parsed.success) {
      throw new BadRequestException('Invalid sortOrder');
    }
    sortOrder = parsed.data;
  }

  return { sortBy, sortOrder };
}

function parseSortParams(query: Record<string, string>) {
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

  return { sortBy, sortOrder };
}

@Controller('timesheets')
export class TimesheetController {
  constructor(
    private readonly timesheetService: TimesheetService,
    private readonly timesheetEvents: TimesheetEventsService,
  ) {}

  @Sse('stream')
  @Roles('ADMIN')
  stream() {
    return this.timesheetEvents.subscribe();
  }

  @Get('dashboard-metrics')
  @Roles('ADMIN')
  dashboardMetrics(@Query() query: Record<string, string>) {
    return this.timesheetService.getDashboardMetrics(
      parseSummaryPeriodQuery(query),
      query.includeExternal === 'true',
    );
  }

  @Get('pinned-summary')
  @Roles('ADMIN')
  pinnedSummary(@Query() query: Record<string, string>) {
    // No period means all-time totals, unlike the other summary endpoints.
    const resolved = parseSummaryPeriodQuery({ ...query, period: query.period ?? 'all' });
    return this.timesheetService.getPinnedProjectsSummary(resolved);
  }

  @Get('project-summary')
  @Roles('ADMIN')
  projectSummary(@Query() query: Record<string, string>) {
    const resolved = parseSummaryPeriodQuery(query);
    return this.timesheetService.getProjectSummary(resolved);
  }

  @Get('person-summary')
  @Roles('ADMIN')
  personSummary(@Query() query: Record<string, string>) {
    const resolved = parseSummaryPeriodQuery(query);
    return this.timesheetService.getPersonSummary(resolved);
  }

  @Get('not-logged')
  @Roles('ADMIN')
  notLogged(@Query() query: Record<string, string>) {
    const resolved = parseSummaryPeriodQuery(query);
    return this.timesheetService.getNotLoggedPersons(
      resolved,
      query.includeExternal === 'true',
    );
  }

  @Get('export.xlsx')
  @Roles('ADMIN')
  async exportXlsx(@Query() query: Record<string, string>, @Res() res: Response) {
    const resolved = parseSummaryPeriodQuery(query);
    const filters = parseListFilters(query);
    const { buffer, filename } = await this.timesheetService.exportXlsx(resolved, {
      personId: filters.personId,
      projectId: filters.projectId,
    });

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get('mine')
  @Roles('ADMIN', 'EMPLOYEE')
  findMine(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query() query: Record<string, string>,
  ) {
    return this.timesheetService.findMine(req.user, parsePagination(query));
  }

  @Get()
  @Roles('ADMIN')
  findAll(@Query() query: Record<string, string>) {
    const { sortBy, sortOrder } = parseSortParams(query);
    return this.timesheetService.findAll(
      parsePagination(query),
      parseListFilters(query),
      sortBy,
      sortOrder,
    );
  }

  @Get('grouped')
  @Roles('ADMIN')
  findAllGrouped(@Query() query: Record<string, string>) {
    const { sortBy, sortOrder } = parseGroupSortParams(query);
    return this.timesheetService.findAllGrouped(
      parsePagination(query),
      parseListFilters(query),
      sortBy,
      sortOrder,
    );
  }

  @Post()
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(createTimesheetSchema)) input: CreateTimesheetInput,
  ) {
    return this.timesheetService.create(req.user, input);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  findOne(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    return this.timesheetService.findOne(req.user, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  update(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateTimesheetSchema)) input: UpdateTimesheetInput,
  ) {
    return this.timesheetService.update(req.user, id, input);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    await this.timesheetService.softDelete(req.user, id);
  }
}
