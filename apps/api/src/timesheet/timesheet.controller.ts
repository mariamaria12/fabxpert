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
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import {
  createTimesheetSchema,
  startTimesheetBodySchema,
  stopTimesheetSchema,
  updateTimesheetSchema,
  type CreateTimesheetInput,
  type StartTimesheetBodyInput,
  type StopTimesheetInput,
  type UpdateTimesheetInput,
} from '@fabxpert/shared/dto/timesheet.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TimesheetService } from './timesheet.service';

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
});

function parseListFilters(query: Record<string, string>) {
  const result = listFiltersSchema.safeParse({
    personId: query.personId,
    projectId: query.projectId,
  });

  if (!result.success) {
    return {};
  }

  return result.data;
}

@Controller('timesheets')
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  @Post('start')
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.CREATED)
  start(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(startTimesheetBodySchema)) input: StartTimesheetBodyInput,
  ) {
    return this.timesheetService.start(req.user, input);
  }

  @Post('stop')
  @Roles('ADMIN', 'EMPLOYEE')
  stop(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(stopTimesheetSchema)) input: StopTimesheetInput,
  ) {
    return this.timesheetService.stop(req.user, input);
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
  createManual(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(createTimesheetSchema)) input: CreateTimesheetInput,
  ) {
    return this.timesheetService.createManual(req.user, input);
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
