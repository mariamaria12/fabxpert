import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CloseOvertimeMonthResponse,
  OvertimeBalanceDto,
} from '@fabxpert/shared/dto/overtime.dto';
import {
  DAILY_WORK_MINUTES,
  earnedOvertimeMinutes,
  overtimeDaysAvailable,
} from '@fabxpert/shared/overtime';
import { countInclusiveLeaveDays } from '@fabxpert/shared/leaveDays';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** First day of `date`'s month, at midnight. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Parses `YYYY-MM` into that month's first day. */
export function parseMonthString(value: string): Date {
  const match = MONTH_PATTERN.exec(value.trim());
  if (!match) {
    throw new BadRequestException('month must be YYYY-MM');
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    throw new BadRequestException('month must be YYYY-MM');
  }

  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

@Injectable()
export class OvertimeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyBalance(actor: AuthenticatedUser): Promise<OvertimeBalanceDto> {
    const personId = await this.resolveActorPersonId(actor.id);
    return this.computeBalance(personId);
  }

  async getBalanceForPerson(personId: string): Promise<OvertimeBalanceDto> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, ...notDeleted() },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException(`Person with id ${personId} not found`);
    }

    return this.computeBalance(personId);
  }

  /**
   * Running overtime balance. A month with an accrual row counts as frozen;
   * every other month is recomputed from timesheets, so a closing that was
   * skipped costs accuracy on old data, never minutes.
   */
  async computeBalance(personId: string): Promise<OvertimeBalanceDto> {
    const [accruals, usedMinutes] = await Promise.all([
      this.prisma.overtimeAccrual.findMany({
        where: { personId },
        select: { month: true, earnedMinutes: true },
        orderBy: { month: 'desc' },
      }),
      this.usedMinutes(personId),
    ]);

    const accruedMinutes = accruals.reduce((sum, row) => sum + row.earnedMinutes, 0);
    const closedMonths = new Set(accruals.map((row) => formatMonth(row.month)));
    const openPeriodMinutes = await this.earnedOutsideClosedMonths(personId, closedMonths);
    const lastClosed = accruals[0] ?? null;

    const remainingMinutes = accruedMinutes + openPeriodMinutes - usedMinutes;

    return {
      personId,
      accruedMinutes,
      openPeriodMinutes,
      usedMinutes,
      remainingMinutes,
      remainingDays: overtimeDaysAvailable(Math.max(0, remainingMinutes)),
      closedThroughMonth: lastClosed ? formatMonth(lastClosed.month) : null,
    };
  }

  /**
   * Freezes one past month for every person who logged time in it. Idempotent —
   * rerunning it overwrites the row, which is how you fix a month after a
   * backdated timesheet correction.
   */
  async closeMonth(month: Date): Promise<CloseOvertimeMonthResponse> {
    const monthStart = startOfMonth(month);
    const monthEnd = startOfNextMonth(monthStart);

    if (monthEnd.getTime() > startOfMonth(new Date()).getTime()) {
      throw new BadRequestException('Only past months can be closed');
    }

    const dailyTotals = await this.prisma.timesheet.groupBy({
      by: ['personId', 'workDate'],
      where: {
        ...notDeleted(),
        workDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { durationMinutes: true },
    });

    const minutesByPerson = new Map<string, number[]>();
    for (const row of dailyTotals) {
      const days = minutesByPerson.get(row.personId) ?? [];
      days.push(row._sum.durationMinutes ?? 0);
      minutesByPerson.set(row.personId, days);
    }

    let personsClosed = 0;
    let totalMinutes = 0;

    for (const [personId, days] of minutesByPerson) {
      const earnedMinutes = earnedOvertimeMinutes(days);
      await this.prisma.overtimeAccrual.upsert({
        where: { personId_month: { personId, month: monthStart } },
        create: { personId, month: monthStart, earnedMinutes },
        update: { earnedMinutes, closedAt: new Date() },
      });
      personsClosed += 1;
      totalMinutes += earnedMinutes;
    }

    return { month: formatMonth(monthStart), personsClosed, totalMinutes };
  }

  /** Overtime earned on days that belong to a month with no accrual row yet. */
  private async earnedOutsideClosedMonths(
    personId: string,
    closedMonths: Set<string>,
  ): Promise<number> {
    const dailyTotals = await this.prisma.timesheet.groupBy({
      by: ['workDate'],
      where: { personId, ...notDeleted() },
      _sum: { durationMinutes: true },
    });

    const openDays = dailyTotals
      .filter((row) => !closedMonths.has(formatMonth(row.workDate)))
      .map((row) => row._sum.durationMinutes ?? 0);

    return earnedOvertimeMinutes(openDays);
  }

  /**
   * Approved RECUPERARE leave. A request in hours costs exactly those minutes;
   * a whole-day one costs a full working day per working day it covers.
   */
  private async usedMinutes(personId: string): Promise<number> {
    const approved = await this.prisma.leaveRequest.findMany({
      where: {
        personId,
        type: 'RECUPERARE',
        status: 'APROBAT',
        ...notDeleted(),
      },
      select: { startDate: true, endDate: true, durationMinutes: true },
    });

    return approved.reduce((sum, request) => {
      if (request.durationMinutes !== null) {
        return sum + request.durationMinutes;
      }

      return (
        sum + countInclusiveLeaveDays(request.startDate, request.endDate) * DAILY_WORK_MINUTES
      );
    }, 0);
  }

  private async resolveActorPersonId(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...notDeleted() },
      select: {
        personId: true,
        person: { select: { deletedAt: true } },
      },
    });

    if (!user || user.person.deletedAt !== null) {
      throw new BadRequestException('Your user account is not linked to a person');
    }

    return user.personId;
  }
}
