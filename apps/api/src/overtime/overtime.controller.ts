import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import {
  resolveAccountingDaysSchema,
  type ResolveAccountingDaysInput,
} from '@fabxpert/shared/dto/overtime.dto';
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
  /** Only these people. Absent means everyone with something to settle. */
  personIds: z.array(uuidParamSchema).min(1).optional(),
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

  /** How many people still wait for last month's approval. */
  @Get('approvals-pending-count')
  @Roles('ADMIN')
  countPendingApprovals() {
    return this.overtimeService.countPendingApprovals();
  }

  /** The pontaj for accounting of one month, recomputed on every call. */
  @Get('accounting')
  @Roles('ADMIN')
  accountingTimesheet(@Query('month', new ZodValidationPipe(monthSchema)) month: string) {
    return this.overtimeService.accountingTimesheet(parseMonthString(month));
  }

  /** Generates the document for accounting and closes the month behind it. */
  @Post('accounting/export')
  @Roles('ADMIN')
  async exportAccountingDocument(
    @Query('month', new ZodValidationPipe(monthSchema)) month: string,
    @Req() req: Request & { user: AuthenticatedUser },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.overtimeService.exportAccountingDocument(
      parseMonthString(month),
      req.user,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  /** Fills days without a pontaj or leave, as decided in the gaps dialog. */
  @Post('accounting/resolve-days')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  resolveAccountingDays(
    @Body(new ZodValidationPipe(resolveAccountingDaysSchema)) input: ResolveAccountingDaysInput,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.overtimeService.resolveAccountingDays(input, req.user);
  }

  /** Reopens a month closed by the export. */
  @Delete('accounting/export')
  @Roles('ADMIN')
  reopenAccountingMonth(@Query('month', new ZodValidationPipe(monthSchema)) month: string) {
    return this.overtimeService.reopenAccountingMonth(parseMonthString(month));
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
      input.personIds,
    );
  }
}
