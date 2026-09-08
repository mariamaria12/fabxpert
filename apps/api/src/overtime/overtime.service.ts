import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccountingExportDto,
  AccountingTimesheetLineDto,
  AccountingTimesheetResponse,
  OvertimeApprovalsPendingResponse,
  ReopenAccountingMonthResponse,
  ResolveAccountingDaysInput,
  ResolveAccountingDaysResponse,
  OvertimeBalanceDto,
  OvertimeBalancePersonDto,
  OvertimeBalancesResponse,
  OvertimeSettlementLineDto,
  OvertimeSettlementPreviewResponse,
  SettleOvertimeMonthResponse,
} from '@fabxpert/shared/dto/overtime.dto';
import {
  DAILY_WORK_MINUTES,
  accountingHours,
  countSaturdaysWorked,
  isMonthSettleable,
  latestSettleableMonth,
  overtimeBalanceMinutes,
  overtimeDaysAvailable,
  settleOvertimeBalance,
  type OvertimeDay,
} from '@fabxpert/shared/overtime';
import {
  isSameWorkDate,
  isWorkingDate,
  normalizeWorkDate,
  parseWorkDateString,
  todayWorkDate,
  workDateToDayKey,
} from '@fabxpert/shared/workDate';
import {
  accountingDocumentLines,
  leaveTypeDayCode,
  PRESENT_DAY_CODE,
} from '@fabxpert/shared/accountingDocument';
import type { LeaveType } from '@fabxpert/shared/dto/leave.dto';
import {
  buildAccountingTimesheetFilename,
  buildAccountingTimesheetXlsx,
} from './overtime-accounting-xlsx.util';
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
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  durationMinutes: number | null;
};

/** Mon–Fri days in the month — the norm on the pontaj. */
function workingDaysInMonth(monthStart: Date): number {
  const end = startOfNextMonth(monthStart);
  let count = 0;
  for (const cursor = new Date(monthStart); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
    if (isWorkingDate(cursor)) {
      count += 1;
    }
  }
  return count;
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

/**
 * The leave type covering each working day, for the pontaj grid. Hours taken
 * as RECUPERARE cover their day too — it reads as present either way.
 */
function leaveTypesByDay(requests: ApprovedLeave[]): Map<string, LeaveType> {
  const byDay = new Map<string, LeaveType>();

  for (const request of requests) {
    if (request.durationMinutes !== null) {
      byDay.set(workDateToDayKey(request.startDate), request.type);
      continue;
    }

    const cursor = normalizeWorkDate(request.startDate);
    const end = normalizeWorkDate(request.endDate);
    while (cursor.getTime() <= end.getTime()) {
      if (isWorkingDate(cursor)) {
        byDay.set(workDateToDayKey(cursor), request.type);
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
  /** Approved leave per person per day key, for the pontaj grid. */
  leaveTypesByPersonDay: Map<string, Map<string, LeaveType>>;
};

/** What one month produced for one person, before it is settled. */
type MonthActivity = {
  earnedMinutes: number;
  usedMinutes: number;
  saturdaysWorked: number;
};

const NO_ACTIVITY: MonthActivity = { earnedMinutes: 0, usedMinutes: 0, saturdaysWorked: 0 };

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

    return this.buildBalance(personId, settlements, this.monthlyActivity(personId, source));
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
    const source = await this.loadOvertimeSource(scanFrom(persons, settlementsByPerson));

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
    personIds?: string[],
  ): Promise<SettleOvertimeMonthResponse> {
    const monthStart = startOfMonth(month);
    this.assertSettleable(monthStart);

    const lines = await this.buildSettlementLines(monthStart, reserveMinutesByPerson, personIds);

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

  /** How many people still wait for the open month's approval — the sidebar badge. */
  async countPendingApprovals(): Promise<OvertimeApprovalsPendingResponse> {
    const monthStart = latestSettleableMonth();
    const lines = await this.buildSettlementLines(monthStart, {});

    return {
      month: formatMonth(monthStart),
      count: lines.filter((line) => line.settledAt === null).length,
    };
  }

  /**
   * The pontaj for accounting of one month: everyone, with the hours they
   * logged split into normal and approved overtime, and the day-by-day grid
   * the document is drawn from. Nothing is written here — the month closes
   * when the document is generated. Overtime only reaches this view once its
   * settlement is approved; until then the line says how much is still waiting.
   */
  async accountingTimesheet(month: Date): Promise<AccountingTimesheetResponse> {
    const monthStart = startOfMonth(month);
    const monthKey = formatMonth(monthStart);
    const settlementOpen = isMonthSettleable(monthStart);
    const nextMonth = startOfNextMonth(monthStart);

    // Office staff are not on the pontaj; external collaborators are, but
    // without a fixed number of days, so nothing counts as missing for them.
    const [persons, settledRows, source, pendingLines, exportRow, presences] = await Promise.all([
      this.listPersons({ includeExternal: true, includeOffice: false, includeAutoPresent: true }),
      this.prisma.overtimeSettlement.findMany({
        where: { month: monthStart },
        select: { personId: true, paidMinutes: true, settledAt: true },
      }),
      this.loadOvertimeSource({ from: monthStart, to: nextMonth }),
      settlementOpen ? this.buildSettlementLines(monthStart, {}) : Promise.resolve([]),
      this.findAccountingExport(monthStart),
      this.prisma.accountingPresence.findMany({
        where: { workDate: { gte: monthStart, lt: nextMonth } },
        select: { personId: true, workDate: true },
      }),
    ]);

    // Days an admin marked present by hand while generating an earlier pontaj.
    const presenceByPerson = new Map<string, Set<string>>();
    for (const row of presences) {
      const days = presenceByPerson.get(row.personId) ?? new Set<string>();
      days.add(workDateToDayKey(row.workDate));
      presenceByPerson.set(row.personId, days);
    }

    const settledByPerson = new Map(settledRows.map((row) => [row.personId, row]));
    const pendingByPerson = new Map(
      pendingLines.filter((line) => line.settledAt === null).map((line) => [line.person.id, line]),
    );
    const today = todayWorkDate();

    const lines: AccountingTimesheetLineDto[] = persons.map((person) => {
      const days = source.daysByPerson.get(person.id) ?? [];
      const loggedByDay = new Map(
        days.map((day) => [workDateToDayKey(day.workDate), day.loggedMinutes]),
      );
      const leaveByDay =
        source.leaveTypesByPersonDay.get(person.id) ?? new Map<string, LeaveType>();
      const activity = this.monthlyActivity(person.id, source).get(monthKey) ?? NO_ACTIVITY;
      const settled = settledByPerson.get(person.id) ?? null;
      const pending = pendingByPerson.get(person.id) ?? null;
      const isExternal = isExternalPerson(person);
      // Never logs time: present on every working day so far, unless on leave.
      const isAutoPresent = person.autoPresence;
      const markedPresent = presenceByPerson.get(person.id) ?? new Set<string>();

      // One code per calendar day. Weekends stay blank on purpose: a Saturday
      // is counted separately, a Sunday's hours go to overtime.
      const dayCodes: string[] = [];
      const missingWorkingDays: string[] = [];
      for (
        const cursor = new Date(monthStart);
        cursor < nextMonth;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const dayKey = workDateToDayKey(cursor);
        const leave = leaveByDay.get(dayKey);
        const isPast = cursor.getTime() < today.getTime();
        const worked =
          (loggedByDay.get(dayKey) ?? 0) > 0 ||
          markedPresent.has(dayKey) ||
          (isAutoPresent && cursor.getTime() <= today.getTime());
        const isWorking = isWorkingDate(cursor);

        let code = '';
        if (leave && isWorking) {
          code = leaveTypeDayCode(leave);
        } else if (worked && isWorking) {
          code = PRESENT_DAY_CODE;
        }
        dayCodes.push(code);

        if (!isExternal && !isAutoPresent && isWorking && code === '' && isPast) {
          missingWorkingDays.push(dayKey);
        }
      }

      const loggedMinutes = sumBy(days, (day) => day.loggedMinutes);
      const split = accountingHours({
        loggedMinutes,
        earnedMinutes: activity.earnedMinutes,
        paidMinutes: settled?.paidMinutes ?? null,
      });

      // A line waits while its settlement is missing; a month whose approvals
      // have not opened waits as a whole, and one with nothing to settle is ready.
      const waiting = !settlementOpen || pending !== null;
      const status = exportRow ? 'EXPORTAT' : settled || !waiting ? 'GATA_EXPORT' : 'IN_PREGATIRE';

      return {
        person: toBalancePerson(person),
        isExternal,
        isAutoPresent,
        loggedMinutes,
        ...split,
        saturdaysWorked: activity.saturdaysWorked,
        dayCodes,
        missingWorkingDays,
        pendingBalanceMinutes: pending?.balanceMinutes ?? null,
        status,
        settledAt: settled?.settledAt.toISOString() ?? null,
      };
    });

    // The totals are the document's: external collaborators are on the lines,
    // so the app can list them apart, but they are not on what accounting gets.
    const documentLines = accountingDocumentLines(lines);
    const pending = documentLines.filter((line) => line.pendingBalanceMinutes !== null);
    const withGaps = documentLines.filter((line) => line.missingWorkingDays.length > 0);

    return {
      month: monthKey,
      settlementOpen,
      workingDays: workingDaysInMonth(monthStart),
      export: exportRow,
      lines,
      totals: {
        persons: documentLines.length,
        normalMinutes: sumBy(documentLines, (line) => line.normalMinutes),
        overtimeMinutes: sumBy(documentLines, (line) => line.overtimeMinutes),
        totalMinutes: sumBy(documentLines, (line) => line.totalMinutes),
        pendingCount: pending.length,
        pendingBalanceMinutes: sumBy(pending, (line) => line.pendingBalanceMinutes ?? 0),
        missingDaysPersons: withGaps.length,
        missingDays: sumBy(withGaps, (line) => line.missingWorkingDays.length),
      },
    };
  }

  /**
   * Builds the document accounting receives and closes the month behind it.
   * Generating again rebuilds the document from the pontaje as they stand and
   * refreshes the close; `reopenAccountingMonth` undoes it.
   */
  async exportAccountingDocument(
    month: Date,
    actor: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string; report: AccountingTimesheetResponse }> {
    const monthStart = startOfMonth(month);

    await this.prisma.accountingExport.upsert({
      where: { month: monthStart },
      create: { month: monthStart, exportedByUserId: actor.id },
      update: { exportedAt: new Date(), exportedByUserId: actor.id },
    });

    const report = await this.accountingTimesheet(monthStart);
    const buffer = await buildAccountingTimesheetXlsx(report);

    return { buffer, filename: buildAccountingTimesheetFilename(report.month), report };
  }

  /**
   * Fills the days the admin decided on in the gaps dialog: "present" is an
   * X with no hours behind it, anything else is an approved single-day leave
   * written straight to the ledger so balances pick it up. A day that got a
   * pontaj or leave in the meantime is skipped, never overwritten.
   */
  async resolveAccountingDays(
    input: ResolveAccountingDaysInput,
    actor: AuthenticatedUser,
  ): Promise<ResolveAccountingDaysResponse> {
    const monthStart = parseMonthString(input.month);
    const nextMonth = startOfNextMonth(monthStart);
    let resolved = 0;
    let skipped = 0;

    for (const item of input.resolutions) {
      const workDate = parseWorkDateString(item.date);
      if (workDate < monthStart || workDate >= nextMonth || !isWorkingDate(workDate)) {
        throw new BadRequestException(`${item.date} is not a working day of ${input.month}`);
      }

      const [timesheets, leave] = await Promise.all([
        this.prisma.timesheet.count({
          where: { ...notDeleted(), personId: item.personId, workDate },
        }),
        this.prisma.leaveRequest.count({
          where: {
            ...notDeleted(),
            personId: item.personId,
            status: { in: ['IN_ASTEPTARE', 'APROBAT'] },
            startDate: { lte: workDate },
            endDate: { gte: workDate },
          },
        }),
      ]);
      if (timesheets > 0 || leave > 0) {
        skipped += 1;
        continue;
      }

      if (item.resolution === 'PRESENT') {
        await this.prisma.accountingPresence.upsert({
          where: { personId_workDate: { personId: item.personId, workDate } },
          create: { personId: item.personId, workDate, markedByUserId: actor.id },
          update: {},
        });
      } else {
        await this.prisma.leaveRequest.create({
          data: {
            personId: item.personId,
            type: item.resolution,
            startDate: workDate,
            endDate: workDate,
            status: 'APROBAT',
            reason: 'Completat la generarea pontajului pentru contabilitate',
            reviewedByUserId: actor.id,
            reviewedAt: new Date(),
          },
        });
      }
      resolved += 1;
    }

    return { resolved, skipped };
  }

  async reopenAccountingMonth(month: Date): Promise<ReopenAccountingMonthResponse> {
    const monthStart = startOfMonth(month);
    const { count } = await this.prisma.accountingExport.deleteMany({
      where: { month: monthStart },
    });

    return { month: formatMonth(monthStart), reopened: count > 0 };
  }

  private async findAccountingExport(monthStart: Date): Promise<AccountingExportDto | null> {
    const row = await this.prisma.accountingExport.findUnique({
      where: { month: monthStart },
      select: {
        exportedAt: true,
        exportedBy: { select: { person: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!row) {
      return null;
    }

    return {
      exportedAt: row.exportedAt.toISOString(),
      exportedBy: row.exportedBy?.person ?? null,
    };
  }

  private assertSettleable(monthStart: Date): void {
    if (!isMonthSettleable(monthStart)) {
      throw new BadRequestException('A month can only be settled from its last week on');
    }
  }

  /**
   * One line per person who has something to settle. People with no activity
   * and nothing carried in are skipped — a settlement row of all zeroes says
   * nothing and would only make the month look busier than it was.
   *
   * `personIds` narrows the lines to those people, so one person can be
   * approved on their own. Someone already approved keeps the reserve from
   * that approval unless `reserveMinutesByPerson` says otherwise, so a preview
   * shows what was decided and a re-approval does not silently pay it out.
   */
  private async buildSettlementLines(
    monthStart: Date,
    reserveMinutesByPerson: Record<string, number>,
    personIds?: string[],
  ): Promise<OvertimeSettlementLineDto[]> {
    const monthKey = formatMonth(monthStart);
    const [persons, settlements, source] = await Promise.all([
      this.listPersons(),
      this.prisma.overtimeSettlement.findMany({
        where: { month: { lte: monthStart } },
        select: { personId: true, month: true, carriedOutMinutes: true, settledAt: true },
        orderBy: { month: 'desc' },
      }),
      this.loadOvertimeSource({ to: startOfNextMonth(monthStart) }),
    ]);

    // Earlier months feed the carry-in; the month itself only says who is done.
    const settlementsByPerson = groupBy(
      settlements.filter((row) => row.month.getTime() < monthStart.getTime()),
      (row) => row.personId,
    );
    const settledByPerson = new Map(
      settlements
        .filter((row) => row.month.getTime() === monthStart.getTime())
        .map((row) => [row.personId, row]),
    );
    const wanted = personIds ? new Set(personIds) : null;
    const lines: OvertimeSettlementLineDto[] = [];

    for (const person of persons) {
      if (wanted && !wanted.has(person.id)) {
        continue;
      }

      const activity = this.monthlyActivity(person.id, source);
      const carriedInMinutes = this.carriedInFor(
        settlementsByPerson.get(person.id) ?? [],
        activity,
        monthKey,
      );
      const month = activity.get(monthKey) ?? NO_ACTIVITY;
      const balanceMinutes = carriedInMinutes + month.earnedMinutes - month.usedMinutes;

      if (balanceMinutes === 0 && carriedInMinutes === 0) {
        continue;
      }

      const settled = settledByPerson.get(person.id) ?? null;
      const storedReserve = Math.max(settled?.carriedOutMinutes ?? 0, 0);
      const reserveMinutes = Math.max(reserveMinutesByPerson[person.id] ?? storedReserve, 0);
      const { paidMinutes, carriedOutMinutes } = settleOvertimeBalance(
        balanceMinutes,
        reserveMinutes,
      );

      lines.push({
        person: toBalancePerson(person),
        carriedInMinutes,
        earnedMinutes: month.earnedMinutes,
        usedMinutes: month.usedMinutes,
        saturdaysWorked: month.saturdaysWorked,
        balanceMinutes,
        reserveMinutes: carriedOutMinutes > 0 ? carriedOutMinutes : 0,
        paidMinutes,
        carriedOutMinutes,
        settledAt: settled?.settledAt.toISOString() ?? null,
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
    const month = activity.get(monthKey) ?? NO_ACTIVITY;
    const remainingMinutes = carriedInMinutes + month.earnedMinutes - month.usedMinutes;

    const lastSettled = latestMonth(settlements);

    return {
      personId,
      month: monthKey,
      carriedInMinutes,
      earnedMinutes: month.earnedMinutes,
      usedMinutes: month.usedMinutes,
      saturdaysWorked: month.saturdaysWorked,
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
      const created = { ...NO_ACTIVITY };
      byMonth.set(key, created);
      return created;
    };

    const daysByMonth = groupBy(source.daysByPerson.get(personId) ?? [], (day) =>
      formatMonth(day.workDate),
    );
    for (const [key, days] of daysByMonth) {
      const month = entry(key);
      month.earnedMinutes = overtimeBalanceMinutes(days);
      month.saturdaysWorked = countSaturdaysWorked(days);
    }

    for (const [key, minutes] of source.usedByPersonMonth.get(personId) ?? []) {
      entry(key).usedMinutes = minutes;
    }

    return byMonth;
  }

  /**
   * Who a computation is about. Overtime keeps the INCLUDE_EXTERNAL_EMPLOYEES
   * default and everyone with a login; the pontaj for accounting asks for the
   * external collaborators too and leaves the office staff out.
   */
  private listPersons(
    scope: {
      includeExternal?: boolean;
      includeOffice?: boolean;
      includeAutoPresent?: boolean;
    } = {},
  ) {
    const includeExternal = scope.includeExternal ?? INCLUDE_EXTERNAL_EMPLOYEES;
    const includeOffice = scope.includeOffice ?? true;
    // People on auto-presence never log time, so overtime leaves them out.
    const includeAutoPresent = scope.includeAutoPresent ?? false;

    return this.prisma.person.findMany({
      where: {
        ...notDeleted(),
        AND: [
          // Persons without a login are kept: external and office are explicit flags.
          ...(includeExternal
            ? []
            : [{ OR: [{ user: null }, { user: { angajatExtern: false } }] }]),
          // Office staff stay off the pontaj unless auto-presence puts them on it.
          ...(includeOffice
            ? []
            : [
                { OR: [{ user: null }, { user: { isOfficeUser: false } }, { autoPresence: true }] },
              ]),
          ...(includeAutoPresent ? [] : [{ autoPresence: false }]),
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        autoPresence: true,
        employeeRole: { select: { name: true } },
        user: { select: { angajatExtern: true } },
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
    const leaveTypesByPersonDay = new Map<string, Map<string, LeaveType>>();
    for (const [personId, requests] of leaveRequestsByPerson) {
      leaveDaysByPerson.set(personId, leaveMinutesByDay(requests));
      leaveTypesByPersonDay.set(personId, leaveTypesByDay(requests));
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
        isSaturday: row.workDate.getDay() === 6,
        isInProgress: isSameWorkDate(row.workDate),
      });
      daysByPerson.set(row.personId, days);
    }

    return { daysByPerson, usedByPersonMonth, leaveTypesByPersonDay };
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
  autoPresence: boolean;
  employeeRole: { name: string } | null;
  user: { angajatExtern: boolean } | null;
};

function toBalancePerson(person: PersonRow): OvertimeBalancePersonDto {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    employeeRole: person.employeeRole,
  };
}

/** A person without a login is on the payroll like anyone else; external is an explicit flag. */
function isExternalPerson(person: PersonRow): boolean {
  return person.user?.angajatExtern ?? false;
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
