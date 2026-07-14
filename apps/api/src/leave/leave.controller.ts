import {
  Body,
  Controller,
  Delete,
  Get,
  BadRequestException,
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
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  reviewLeaveRequestSchema,
  LEAVE_STATUS_VALUES,
  type CreateLeaveRequestInput,
  type UpdateLeaveRequestInput,
  type ReviewLeaveRequestInput,
} from '@fabxpert/shared/dto/leave.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePagination } from '../common/pagination/parse-pagination.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LeaveService, type LeaveRequestListFilters } from './leave.service';
import { parseSummaryPeriodQuery } from '../timesheet/timesheet-summary-period.util';

const idParamSchema = z.string().trim().min(1);

const uuidQuerySchema = z
  .string()
  .regex(
    /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const listFiltersSchema = z.object({
  status: z.enum(LEAVE_STATUS_VALUES).optional(),
  personId: uuidQuerySchema.optional(),
});

function parseListFilters(query: Record<string, string>): LeaveRequestListFilters {
  const result = listFiltersSchema.safeParse({
    status: query.status,
    personId: query.personId,
  });
  return result.success ? { ...result.data } : {};
}

@Controller('leave-requests')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('mine')
  @Roles('ADMIN', 'EMPLOYEE')
  findMine(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query() query: Record<string, string>,
  ) {
    return this.leaveService.findMine(req.user, parsePagination(query));
  }

  @Get('my-balance')
  @Roles('ADMIN', 'EMPLOYEE')
  getMyBalance(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.leaveService.getMyBalance(req.user);
  }

  @Get('balance/:personId')
  @Roles('ADMIN')
  getBalance(
    @Param('personId', new ZodValidationPipe(uuidQuerySchema)) personId: string,
  ) {
    return this.leaveService.getBalanceForPerson(personId);
  }

  @Get('on-leave')
  @Roles('ADMIN')
  findOnLeave(@Query() query: Record<string, string>) {
    const resolved = parseSummaryPeriodQuery(query);
    if (resolved.from === null || resolved.to === null) {
      throw new BadRequestException('on-leave requires a bounded period');
    }

    return this.leaveService.findOnLeave(resolved.period, resolved.from, resolved.to);
  }

  @Get()
  @Roles('ADMIN')
  findAll(@Query() query: Record<string, string>) {
    return this.leaveService.findAll(parsePagination(query), parseListFilters(query));
  }

  @Post()
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(createLeaveRequestSchema)) input: CreateLeaveRequestInput,
  ) {
    return this.leaveService.create(req.user, input);
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.leaveService.findOneAdmin(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  update(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateLeaveRequestSchema)) input: UpdateLeaveRequestInput,
  ) {
    return this.leaveService.updateOwn(req.user, id, input);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    await this.leaveService.softDeleteOwn(req.user, id);
  }

  @Post(':id/review')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  review(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(reviewLeaveRequestSchema)) input: ReviewLeaveRequestInput,
  ) {
    return this.leaveService.review(req.user, id, input);
  }
}
