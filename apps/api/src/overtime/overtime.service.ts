import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  OvertimeBalanceDto,
  OvertimeBalancePersonDto,
  OvertimeBalancesResponse,
  OvertimeSettlementLineDto,
  OvertimeSettlementPreviewResponse,
  SettleOvertimeMonthResponse,
} from '@fabxpert/shared/dto/overtime.dto';
import {
  DAILY_WORK_MINUTES,
  overtimeBalanceMinutes,
  overtimeDaysAvailable,
  settleOvertimeBalance,
  type OvertimeDay,
} from '@fabxpert/shared/overtime';
import {
  isSameWorkDate,
  isWorkingDate,
  normalizeWorkDate,
  workDateToDayKey,
} from '@fabxpert/shared/workDate';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/**
 * External collaborators are left out of overtime for now — they are not on the
 * contractual working day the balance is measured against. Flip this to include
 * them; it is the only place the rule is applied.
 */
const INCLUDE_EXTERNAL_EMPLOYEES = false;

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

/** A logged day plus the date it fell on, so callers can bucket it by month. */
type DatedOvertimeDay = OvertimeDay & { workDate: Date };

type OvertimeSourceData = {
  /** Days each person logged time on, ready for the balance rule. */
  daysByPerson: Map<string, DatedOvertimeDay[]>;
  /** RECUPERARE per person per `YYYY-MM` — what the balance is spent on. */
  usedByPersonMonth: Map<string, Map<string, number>>;
};

/** What one month produced for one person, before it is settled. */
type MonthActivity = {
  earnedMinutes: number;
  usedMinutes: number;
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
   * This month's balance: what was carried in, plus what this month produced.
   * Everything older was settled — paid out or carried on — so it is not summed
   * again here.
   */
  async computeBalance(personId: string): Promise<OvertimeBalanceDto> {
    const [settlements, source] = await Promise.all([
      this.prisma.overtimeSettlement.findMany({
        where: { personId },
        select: { month: true, carriedOutMinutes: true },
        orderBy: { month: 'desc' },
      }),
      this.loadOvertimeSource({ personId }),
    ]);

    return this.buildBalance(
      personId,
      settlements,
      this.monthlyActivity(personId, source),
    );
  }

  /**
   * The same balance for everyone, without a query per person. External
   * collaborators are left out unless INCLUDE_EXTERNAL_EMPLOYEES says otherwise.
   *
   * The timesheet scan is bounded by the earliest month still unsettled on
   * anyone, so a history that is settled up to date stays cheap to read.
   */
  async computeAllBalances(): Promise<OvertimeBalancesResponse> {
    const [persons, settlements] = await Promise.all([
      this.listPersons(),
      this.prisma.overtimeSettlement.findMany({
        select: { personId: true, month: true, carriedOutMinutes: true },
        orderBy: { month: 'desc' },
      }),
    ]);

    const settlementsByPerson = groupBy(settlements, (row) => row.personId);
    const source = await this.loadOvertimeSource(
      scanFrom(persons, settlementsByPerson),
    );

    return {
      rows: persons.map((person) => ({
        person: toBalancePerson(person),
        balance: this.buildBalance(
          person.id,
          settlementsByPerson.get(person.id) ?? [],
          this.monthlyActivity(person.id, source),
        ),
      })),
    };
  }

  /** What settling `month` would do, without writing anything. */
  async previewSettlement(month: Date): Promise<OvertimeSettlementPreviewResponse> {
    const monthStart = startOfMonth(month);
    this.assertSettleable(monthStart);

    const lines = await this.buildSettlementLines(monthStart, {});
    const existing = await this.prisma.overtimeSettlement.count({
      where: { month: monthStart },
    });

    return {
      month: formatMonth(monthStart),
      alreadySettled: existing > 0,
      lines,
      totalPaidMinutes: sumBy(lines, (line) => line.paidMinutes),
      totalCarriedOutMinutes: sumBy(lines, (line) => line.carriedOutMinutes),
    };
  }

  /**
   * Settles one past month for everyone who has a balance or a carried-in
   * figure. Idempotent — settling again overwrites the row, which is how a
   * month is fixed after a backdated timesheet correction. The difference then
   * shows up in the months that follow, because they carry from here.
   */
  async settleMonth(
    month: Date,
    reserveMinutesByPerson: Record<string, number>,
    actor: AuthenticatedUser,
  ): Promise<SettleOvertimeMonthResponse> {
    const monthStart = startOfMonth(month);
    this.assertSettleable(monthStart);

    const lines = await this.buildSettlementLines(monthStart, reserveMinutesByPerson);

    await this.prisma.$transaction(
      lines.map((line) =>
        this.prisma.overtimeSettlement.upsert({
          where: { personId_month: { personId: line.person.id, month: monthStart } },
          create: {
            personId: line.person.id,
            month: monthStart,
            carriedInMinutes: line.carriedInMinutes,
            earnedMinutes: line.earnedMinutes,
            usedMinutes: line.usedMinutes,
            paidMinutes: line.paidMinutes,
            carriedOutMinutes: line.carriedOutMinutes,
            settledByUserId: actor.id,
          },
          update: {
            carriedInMinutes: line.carriedInMinutes,
            earnedMinutes: line.earnedMinutes,
            usedMinutes: line.usedMinutes,
            paidMinutes: line.paidMinutes,
            carriedOutMinutes: line.carriedOutMinutes,
            settledAt: new Date(),
            settledByUserId: actor.id,
          },
        }),
      ),
    );

    return {
      month: formatMonth(monthStart),
      personsSettled: lines.length,
      totalPaidMinutes: sumBy(lines, (line) => line.paidMinutes),
      totalCarriedOutMinutes: sumBy(lines, (line) => line.carriedOutMinutes),
    };
  }

  private assertSettleable(monthStart: Date): void {
    if (startOfNextMonth(monthStart).getTime() > startOfMonth(new Date()).getTime()) {
      throw new BadRequestException('Only past months can be settled');
    }
  }

  /**
   * One line per person who has something to settle. People with no activity
   * and nothing carried in are skipped — a settlement row of all zeroes says
   * nothing and would only make the month look busier than it was.
   */
  private async buildSettlementLines(
    monthStart: Date,
    reserveMinutesByPerson: Record<string, number>,
  ): Promise<OvertimeSettlementLineDto[]> {
    const monthKey = formatMonth(monthStart);
    const [persons, settlements, source] = await Promise.all([
      this.listPersons(),
      this.prisma.overtimeSettlement.findMany({
        where: { month: { lt: monthStart } },
        select: { personId: true, month: true, carriedOutMinutes: true },
        orderBy: { month: 'desc' },
      }),
      this.loadOvertimeSource({ to: startOfNextMonth(monthStart) }),
    ]);

    const settlementsByPerson = groupBy(settlements, (row) => row.personId);
    const lines: OvertimeSettlementLineDto[] = [];

    for (const person of persons) {
      const activity = this.monthlyActivity(person.id, source);
      const carriedInMinutes = this.carriedInFor(
        settlementsByPerson.get(person.id) ?? [],
        activity,
        monthKey,
      );
      const month = activity.get(monthKey) ?? { earnedMinutes: 0, usedMinutes: 0 };
      const balanceMinutes =
        carriedInMinutes + month.earnedMinutes - month.usedMinutes;

      if (balanceMinutes === 0 && carriedInMinutes === 0) {
        continue;
      }

      const reserveMinutes = Math.max(reserveMinutesByPerson[person.id] ?? 0, 0);
      const { paidMinutes, carriedOutMinutes } = settleOvertimeBalance(
        balanceMinutes,
        reserveMinutes,
      );

      lines.push({
        person: toBalancePerson(person),
        carriedInMinutes,
        earnedMinutes: month.earnedMinutes,
        usedMinutes: month.usedMinutes,
        balanceMinutes,
        reserveMinutes: carriedOutMinutes > 0 ? carriedOutMinutes : 0,
        paidMinutes,
        carriedOutMinutes,
      });
    }

    return lines;
  }

  private buildBalance(
    personId: string,
    settlements: { month: Date; carriedOutMinutes: number }[],
    activity: Map<string, MonthActivity>,
  ): OvertimeBalanceDto {
    const currentMonth = startOfMonth(new Date());
    const monthKey = formatMonth(currentMonth);

    const carriedInMinutes = this.carriedInFor(settlements, activity, monthKey);
    const month = activity.get(monthKey) ?? { earnedMinutes: 0, usedMinutes: 0 };
    const remainingMinutes =
      carriedInMinutes + month.earnedMinutes - month.usedMinutes;

    const lastSettled = latestMonth(settlements);

    return {
      personId,
      month: monthKey,
      carriedInMinutes,
      earnedMinutes: month.earnedMinutes,
      usedMinutes: month.usedMinutes,
      remainingMinutes,
      remainingDays: overtimeDaysAvailable(Math.max(0, remainingMinutes)),
      settledThroughMonth: lastSettled ? formatMonth(lastSettled) : null,
    };
  }

  /**
   * What `monthKey` starts from: the last settlement's carry-out, plus every
   * month between then and now that was never settled. A settlement that was
   * skipped costs accuracy on old data, never minutes.
   */
  private carriedInFor(
    settlements: { month: Date; carriedOutMinutes: number }[],
    activity: Map<string, MonthActivity>,
    monthKey: string,
  ): number {
    const lastSettled = latestMonth(settlements);
    const carriedOut = lastSettled
      ? (settlements.find((row) => row.month.getTime() === lastSettled.getTime())
          ?.carriedOutMinutes ?? 0)
      : 0;

    const lastSettledKey = lastSettled ? formatMonth(lastSettled) : null;
    let unsettled = 0;
    for (const [key, month] of activity) {
      const afterLastSettled = lastSettledKey === null || key > lastSettledKey;
      if (afterLastSettled && key < monthKey) {
        unsettled += month.earnedMinutes - month.usedMinutes;
      }
    }

    return carriedOut + unsettled;
  }

  /** One person's timesheets and RECUPERARE, folded into a figure per month. */
  private monthlyActivity(
    personId: string,
    source: OvertimeSourceData,
  ): Map<string, MonthActivity> {
    const byMonth = new Map<string, MonthActivity>();

    const entry = (key: string): MonthActivity => {
      const existing = byMonth.get(key);
      if (existing) {
        return existing;
      }
      const created = { earnedMinutes: 0, usedMinutes: 0 };
      byMonth.set(key, created);
      return created;
    };

    const daysByMonth = groupBy(source.daysByPerson.get(personId) ?? [], (day) =>
      formatMonth(day.workDate),
    );
    for (const [key, days] of daysByMonth) {
      entry(key).earnedMinutes = overtimeBalanceMinutes(days);
    }

    for (const [key, minutes] of source.usedByPersonMonth.get(personId) ?? []) {
      entry(key).usedMinutes = minutes;
    }

    return byMonth;
  }

  private listPersons() {
    return this.prisma.person.findMany({
      where: {
        ...notDeleted(),
        ...(INCLUDE_EXTERNAL_EMPLOYEES
          ? {}
          : // Persons without a login are kept: external is an explicit flag.
            { OR: [{ user: null }, { user: { angajatExtern: false } }] }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeRole: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /**
   * The single place timesheets and leave become balance days. Every caller
   * reads the same numbers from here, so the rule can only be applied one way.
   *
   * `from`/`to` bound the timesheet scan only: leave is always read in full,
   * because it is bucketed per month afterwards.
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
    const usedByPersonMonth = new Map<string, Map<string, number>>();
    for (const request of approvedLeave) {
      const requests = leaveRequestsByPerson.get(request.personId) ?? [];
      requests.push(request);
      leaveRequestsByPerson.set(request.personId, requests);

      if (request.type === 'RECUPERARE') {
        const byMonth = usedByPersonMonth.get(request.personId) ?? new Map();
        // Hours are taken on startDate; whole days spread over the days they
        // cover, so a request crossing a month boundary lands on both months.
        if (request.durationMinutes !== null) {
          addTo(byMonth, formatMonth(request.startDate), request.durationMinutes);
        } else {
          for (const [dayKey, minutes] of leaveMinutesByDay([request])) {
            addTo(byMonth, dayKey.slice(0, 7), minutes);
          }
        }
        usedByPersonMonth.set(request.personId, byMonth);
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
        isInProgress: isSameWorkDate(row.workDate),
      });
      daysByPerson.set(row.personId, days);
    }

    return { daysByPerson, usedByPersonMonth };
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

type PersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeRole: { name: string } | null;
};

function toBalancePerson(person: PersonRow): OvertimeBalancePersonDto {
  return person;
}

function addTo(map: Map<string, number>, key: string, minutes: number): void {
  map.set(key, (map.get(key) ?? 0) + minutes);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const bucket = grouped.get(key(item)) ?? [];
    bucket.push(item);
    grouped.set(key(item), bucket);
  }
  return grouped;
}

function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((sum, item) => sum + value(item), 0);
}

function latestMonth(rows: { month: Date }[]): Date | null {
  return rows.reduce<Date | null>(
    (latest, row) => (!latest || row.month > latest ? row.month : latest),
    null,
  );
}

/**
 * How far back the timesheet scan has to reach: the month after the earliest
 * last-settled month across everyone. Anyone never settled pulls it back to the
 * beginning, because their whole history still has to be recomputed.
 */
function scanFrom(
  persons: { id: string }[],
  settlementsByPerson: Map<string, { month: Date }[]>,
): { from?: Date } {
  let earliest: Date | null = null;

  for (const person of persons) {
    const lastSettled = latestMonth(settlementsByPerson.get(person.id) ?? []);
    if (!lastSettled) {
      return {};
    }

    const start = new Date(lastSettled.getFullYear(), lastSettled.getMonth() + 1, 1);
    if (!earliest || start < earliest) {
      earliest = start;
    }
  }

  return earliest ? { from: earliest } : {};
}
