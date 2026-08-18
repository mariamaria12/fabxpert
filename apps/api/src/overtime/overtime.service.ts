import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CloseOvertimeMonthResponse,
  OvertimeBalanceDto,
  OvertimeBalancesResponse,
} from '@fabxpert/shared/dto/overtime.dto';
import {
  DAILY_WORK_MINUTES,
  overtimeBalanceMinutes,
  overtimeDaysAvailable,
  type OvertimeDay,
} from '@fabxpert/shared/overtime';
import { countInclusiveLeaveDays } from '@fabxpert/shared/leaveDays';
import { isWorkingDate, normalizeWorkDate, workDateToDayKey } from '@fabxpert/shared/workDate';
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

type ApprovedLeave = {
  startDate: Date;
  endDate: Date;
  durationMinutes: number | null;
};

/** What one approved RECUPERARE request costs: its hours, or a day per working day. */
function leaveRequestMinutes(request: ApprovedLeave): number {
  if (request.durationMinutes !== null) {
    return request.durationMinutes;
  }

  return countInclusiveLeaveDays(request.startDate, request.endDate) * DAILY_WORK_MINUTES;
}

/**
 * Approved leave spread over the days it covers, keyed by day. A day already
 * paid for by leave must not also read as a short working day.
 */
function leaveMinutesByDay(requests: ApprovedLeave[]): Map<string, number> {
  const byDay = new Map<string, number>();

  const add = (day: Date, minutes: number) => {
    const key = workDateToDayKey(day);
    byDay.set(key, (byDay.get(key) ?? 0) + minutes);
  };

  for (const request of requests) {
    if (request.durationMinutes !== null) {
      add(request.startDate, request.durationMinutes);
      continue;
    }

    const cursor = normalizeWorkDate(request.startDate);
    const end = normalizeWorkDate(request.endDate);
    while (cursor.getTime() <= end.getTime()) {
      if (isWorkingDate(cursor)) {
        add(cursor, DAILY_WORK_MINUTES);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return byDay;
}

/** A logged day plus the date it fell on, so callers can filter by month. */
type DatedOvertimeDay = OvertimeDay & { workDate: Date };

type OvertimeSourceData = {
  /** Days each person logged time on, ready for the balance rule. */
  daysByPerson: Map<string, DatedOvertimeDay[]>;
  /** Approved RECUPERARE per person — what the balance is spent on, all time. */
  usedByPerson: Map<string, number>;
};

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
    const [accruals, source] = await Promise.all([
      this.prisma.overtimeAccrual.findMany({
        where: { personId },
        select: { month: true, earnedMinutes: true },
        orderBy: { month: 'desc' },
      }),
      this.loadOvertimeSource({ personId }),
    ]);

    const accruedMinutes = accruals.reduce((sum, row) => sum + row.earnedMinutes, 0);
    const closedMonths = new Set(accruals.map((row) => formatMonth(row.month)));
    const lastClosed = accruals[0] ?? null;

    const openPeriodMinutes = overtimeBalanceMinutes(
      openDays(source.daysByPerson.get(personId) ?? [], closedMonths),
    );
    const usedMinutes = source.usedByPerson.get(personId) ?? 0;
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
   * Same balance as computeBalance, for everyone, without a query per person.
   * The live scan is bounded by the earliest month still open on any person, so
   * a fully closed history keeps it cheap.
   */
  async computeAllBalances(): Promise<OvertimeBalancesResponse> {
    const [persons, accruals] = await Promise.all([
      this.prisma.person.findMany({
        where: notDeleted(),
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeRole: { select: { name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.overtimeAccrual.findMany({
        select: { personId: true, month: true, earnedMinutes: true },
      }),
    ]);

    const closedMonthsByPerson = new Map<string, Set<string>>();
    const accruedByPerson = new Map<string, number>();
    const lastClosedByPerson = new Map<string, Date>();

    for (const row of accruals) {
      const months = closedMonthsByPerson.get(row.personId) ?? new Set<string>();
      months.add(formatMonth(row.month));
      closedMonthsByPerson.set(row.personId, months);
      accruedByPerson.set(
        row.personId,
        (accruedByPerson.get(row.personId) ?? 0) + row.earnedMinutes,
      );

      const lastClosed = lastClosedByPerson.get(row.personId);
      if (!lastClosed || row.month > lastClosed) {
        lastClosedByPerson.set(row.personId, row.month);
      }
    }

    let scanAll = false;
    let openStart: Date | null = null;
    for (const person of persons) {
      const lastClosed = lastClosedByPerson.get(person.id);
      if (!lastClosed) {
        scanAll = true;
        break;
      }

      const start = startOfNextMonth(lastClosed);
      if (!openStart || start < openStart) {
        openStart = start;
      }
    }

    const source = await this.loadOvertimeSource(
      !scanAll && openStart ? { from: openStart } : {},
    );

    return {
      rows: persons.map((person) => {
        const accruedMinutes = accruedByPerson.get(person.id) ?? 0;
        const openPeriodMinutes = overtimeBalanceMinutes(
          openDays(
            source.daysByPerson.get(person.id) ?? [],
            closedMonthsByPerson.get(person.id) ?? new Set(),
          ),
        );
        const usedMinutes = source.usedByPerson.get(person.id) ?? 0;
        const remainingMinutes = accruedMinutes + openPeriodMinutes - usedMinutes;
        const lastClosed = lastClosedByPerson.get(person.id);

        return {
          person,
          balance: {
            personId: person.id,
            accruedMinutes,
            openPeriodMinutes,
            usedMinutes,
            remainingMinutes,
            remainingDays: overtimeDaysAvailable(Math.max(0, remainingMinutes)),
            closedThroughMonth: lastClosed ? formatMonth(lastClosed) : null,
          },
        };
      }),
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

    const source = await this.loadOvertimeSource({ from: monthStart, to: monthEnd });

    let personsClosed = 0;
    let totalMinutes = 0;

    for (const [personId, days] of source.daysByPerson) {
      const earnedMinutes = overtimeBalanceMinutes(days);
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

  /**
   * The single place timesheets and leave become balance days. One person, one
   * month, or everyone — every caller reads the same numbers from here, so the
   * rule can only ever be applied one way.
   *
   * `from`/`to` bound the timesheet scan only: leave is always read in full,
   * because RECUPERARE taken before the window still spends the balance.
   */
  private async loadOvertimeSource(scope: {
    personId?: string;
    from?: Date;
    to?: Date;
  }): Promise<OvertimeSourceData> {
    const personFilter = scope.personId ? { personId: scope.personId } : {};
    const workDateFilter =
      scope.from || scope.to
        ? {
            workDate: {
              ...(scope.from ? { gte: scope.from } : {}),
              ...(scope.to ? { lt: scope.to } : {}),
            },
          }
        : {};

    const [dailyTotals, approvedLeave] = await Promise.all([
      this.prisma.timesheet.groupBy({
        by: ['personId', 'workDate'],
        where: { ...notDeleted(), ...personFilter, ...workDateFilter },
        _sum: { durationMinutes: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: { status: 'APROBAT', ...notDeleted(), ...personFilter },
        select: {
          personId: true,
          type: true,
          startDate: true,
          endDate: true,
          durationMinutes: true,
        },
      }),
    ]);

    // Any approved leave covers a day; only RECUPERARE spends the balance.
    const leaveRequestsByPerson = new Map<string, ApprovedLeave[]>();
    const usedByPerson = new Map<string, number>();
    for (const request of approvedLeave) {
      const requests = leaveRequestsByPerson.get(request.personId) ?? [];
      requests.push(request);
      leaveRequestsByPerson.set(request.personId, requests);

      if (request.type === 'RECUPERARE') {
        usedByPerson.set(
          request.personId,
          (usedByPerson.get(request.personId) ?? 0) + leaveRequestMinutes(request),
        );
      }
    }

    const leaveDaysByPerson = new Map<string, Map<string, number>>();
    for (const [personId, requests] of leaveRequestsByPerson) {
      leaveDaysByPerson.set(personId, leaveMinutesByDay(requests));
    }

    const daysByPerson = new Map<string, DatedOvertimeDay[]>();
    for (const row of dailyTotals) {
      const leaveByDay = leaveDaysByPerson.get(row.personId);
      const days = daysByPerson.get(row.personId) ?? [];

      days.push({
        workDate: row.workDate,
        loggedMinutes: row._sum.durationMinutes ?? 0,
        leaveMinutes: leaveByDay?.get(workDateToDayKey(row.workDate)) ?? 0,
        isWorkingDay: isWorkingDate(row.workDate),
      });
      daysByPerson.set(row.personId, days);
    }

    return { daysByPerson, usedByPerson };
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

/** Days in months that have no accrual row yet — the part still recomputed live. */
function openDays(days: DatedOvertimeDay[], closedMonths: Set<string>): DatedOvertimeDay[] {
  return days.filter((day) => !closedMonths.has(formatMonth(day.workDate)));
}
