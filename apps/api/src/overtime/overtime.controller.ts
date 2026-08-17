import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
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

const closeMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
});

type CloseMonthInput = z.infer<typeof closeMonthSchema>;

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

  /** Freezes a past month for everyone. Safe to rerun — it overwrites. */
  @Post('close-month')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  closeMonth(@Body(new ZodValidationPipe(closeMonthSchema)) input: CloseMonthInput) {
    return this.overtimeService.closeMonth(parseMonthString(input.month));
  }
}
