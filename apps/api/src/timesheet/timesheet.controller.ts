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
  Res,
  Sse,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createTimesheetSchema,
  updateTimesheetSchema,
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
  dashboardMetrics() {
    return this.timesheetService.getDashboardMetrics();
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
    return this.timesheetService.findAll(parsePagination(query), parseListFilters(query));
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
