import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OvertimeService, parseMonthString } from './overtime.service';

const uuidParamSchema = z
  .string()
  .regex(
    /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM');

const settleMonthSchema = z.object({
  month: monthSchema,
  /** Minutes each person keeps instead of being paid. Absent means pay it all. */
  reserveMinutesByPerson: z.record(z.string(), z.number().int().min(0)).default({}),
});

type SettleMonthInput = z.infer<typeof settleMonthSchema>;

@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Get('my-balance')
  @Roles('ADMIN', 'EMPLOYEE')
  getMyBalance(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.overtimeService.getMyBalance(req.user);
  }

  @Get('balances')
  @Roles('ADMIN')
  listBalances() {
    return this.overtimeService.computeAllBalances();
  }

  @Get('balance/:personId')
  @Roles('ADMIN')
  getBalance(@Param('personId', new ZodValidationPipe(uuidParamSchema)) personId: string) {
    return this.overtimeService.getBalanceForPerson(personId);
  }

  /** What settling a month would pay and carry, without writing anything. */
  @Get('settlement-preview')
  @Roles('ADMIN')
  previewSettlement(@Query('month', new ZodValidationPipe(monthSchema)) month: string) {
    return this.overtimeService.previewSettlement(parseMonthString(month));
  }

  /** Settles a past month for everyone. Safe to rerun — it overwrites. */
  @Post('settle-month')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  settleMonth(
    @Body(new ZodValidationPipe(settleMonthSchema)) input: SettleMonthInput,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.overtimeService.settleMonth(
      parseMonthString(input.month),
      input.reserveMinutesByPerson,
      req.user,
    );
  }
}
