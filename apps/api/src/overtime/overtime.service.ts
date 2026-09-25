import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccountingExportDto,
  AccountingTimesheetLineDto,
  AccountingTimesheetResponse,
  CreateOvertimeCorrectionInput,
  OvertimeApprovalsPendingResponse,
  OvertimeCorrectionDto,
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
  accountingHours,
  approvedMonthCarry,
  countSaturdaysWorked,
  dailyWorkMinutesOf,
  isMonthSettleable,
  isOvertimeLineAwaitingApproval,
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

/** Working days in the month, holidays excluded — the norm on the pontaj. */
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
 * paid for by leave must not also read as a short working day. A whole day
 * off is worth the person's daily norm.
 */
function leaveMinutesByDay(
  requests: ApprovedLeave[],
  dailyWorkMinutes: number,
): Map<string, number> {
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
        add(cursor, dailyWorkMinutes);
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
  /** RECUPERARE per person per `YYYY-MM-DD` — what the balance is spent on. */
  usedByPersonDay: Map<string, Map<string, number>>;
  /** Approved leave per person per day key, for the pontaj grid. */
  leaveTypesByPersonDay: Map<string, Map<string, LeaveType>>;
  /** Norms set on the person; anyone missing here is on the default day. */
  dailyWorkMinutesByPerson: Map<string, number>;
  /** The latest balance an admin set by hand, per person. */
  correctionByPerson: Map<string, OvertimeCorrectionRow>;
};

/** A balance set by hand: it stands in for everything before `effectiveDate`. */
type OvertimeCorrectionRow = {
  id: string;
  effectiveDate: Date;
  balanceMinutes: number;
  previousBalanceMinutes: number;
  note: string | null;
  createdAt: Date;
  createdBy: { person: { firstName: string; lastName: string } } | null;
};

const CORRECTION_SELECT = {
  id: true,
  personId: true,
  effectiveDate: true,
  balanceMinutes: true,
  previousBalanceMinutes: true,
  note: true,
  createdAt: true,
  createdBy: { select: { person: { select: { firstName: true, lastName: true } } } },
} as const;

/** What one month produced for one person, before it is settled. */
type MonthActivity = {
  earnedMinutes: number;
  usedMinutes: number;
  saturdaysWorked: number;
};

const NO_ACTIVITY: MonthActivity = { earnedMinutes: 0, usedMinutes: 0, saturdaysWorked: 0 };

/** An approved month, read back to carry from it. */
type SettlementRow = {
  month: Date;
  carriedInMinutes: number;
  earnedMinutes: number;
  usedMinutes: number;
  paidMinutes: number;
  carriedOutMinutes: number;
  settledAt: Date;
};

const SETTLEMENT_SELECT = {
  month: true,
  carriedInMinutes: true,
  earnedMinutes: true,
  usedMinutes: true,
  paidMinutes: true,
  carriedOutMinutes: true,
  settledAt: true,
} as const;

/** What a month starts from, and the approval it carries from. */
type CarryIn = {
  minutes: number;
  /** The latest approval before the month, with its hours as they stand now. */
  lastApproval: { row: SettlementRow; live: MonthActivity } | null;
};

/**
 * One line of a month's settlement. `previousApproval` is the person's
 * previous approval rewritten to carry what moved in it since it was given,
 * so approving this line takes those hours on exactly once.
 */
type SettlementLine = {
  dto: OvertimeSettlementLineDto;
  previousApproval: {
    month: Date;
    earnedMinutes: number;
    usedMinutes: number;
    carriedOutMinutes: number;
  } | null;
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
        select: SETTLEMENT_SELECT,
        orderBy: { month: 'desc' },
      }),
      this.loadOvertimeSource({ personId }),
    ]);

    const correction = source.correctionByPerson.get(personId) ?? null;
    return this.buildBalance(
      personId,
      settlements,
      this.monthlyActivity(personId, source, correction),
      dailyWorkMinutesFor(source, personId),
      correction,
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
        select: { personId: true, ...SETTLEMENT_SELECT },
        orderBy: { month: 'desc' },
      }),
    ]);

    const settlementsByPerson = groupBy(settlements, (row) => row.personId);
    const source = await this.loadOvertimeSource(scanFrom(persons, settlementsByPerson));

    return {
      rows: persons.map((person) => {
        const correction = source.correctionByPerson.get(person.id) ?? null;
        return {
          person: toBalancePerson(person),
          balance: this.buildBalance(
            person.id,
            settlementsByPerson.get(person.id) ?? [],
            this.monthlyActivity(person.id, source, correction),
            dailyWorkMinutesFor(source, person.id),
            correction,
          ),
        };
      }),
    };
  }

  /** What settling `month` would do, without writing anything. */
  async previewSettlement(month: Date): Promise<OvertimeSettlementPreviewResponse> {
    const monthStart = startOfMonth(month);
    this.assertSettleable(monthStart);

    const lines = (await this.buildSettlementLines(monthStart, {})).map((line) => line.dto);
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

    const settlementLines = await this.buildSettlementLines(
      monthStart,
      reserveMinutesByPerson,
      personIds,
    );
    const lines = settlementLines.map((line) => line.dto);

    await this.prisma.$transaction([
      ...lines.map((line) =>
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
      // What moved in the previous approval now travels in this month's
      // carry-in, so that approval carries it too — its pay stays as it was.
      ...settlementLines.flatMap(({ dto, previousApproval }) =>
        previousApproval
          ? [
              this.prisma.overtimeSettlement.update({
                where: {
                  personId_month: { personId: dto.person.id, month: previousApproval.month },
                },
                data: {
                  earnedMinutes: previousApproval.earnedMinutes,
                  usedMinutes: previousApproval.usedMinutes,
                  carriedOutMinutes: previousApproval.carriedOutMinutes,
                },
              }),
            ]
          : [],
      ),
    ]);

    return {
      month: formatMonth(monthStart),
      personsSettled: lines.length,
      totalPaidMinutes: sumBy(lines, (line) => line.paidMinutes),
      totalCarriedOutMinutes: sumBy(lines, (line) => line.carriedOutMinutes),
    };
  }

  /**
   * Sets a person's balance by hand. It replaces everything before today, a
   * month still waiting for approval included; today's hours count on top,
   * so work logged later in the day is never lost.
   */
  async createCorrection(
    input: CreateOvertimeCorrectionInput,
    actor: AuthenticatedUser,
  ): Promise<OvertimeCorrectionDto> {
    const current = await this.getBalanceForPerson(input.personId);

    const correction = await this.prisma.overtimeCorrection.create({
      data: {
        personId: input.personId,
        effectiveDate: todayWorkDate(),
        balanceMinutes: input.balanceMinutes,
        previousBalanceMinutes: current.remainingMinutes,
        note: input.note ?? null,
        createdByUserId: actor.id,
      },
      select: CORRECTION_SELECT,
    });

    return toCorrectionDto(correction);
  }

  /** Undoes a correction: the balance falls back to whatever stood before it. */
  async deleteCorrection(id: string): Promise<void> {
    const { count } = await this.prisma.overtimeCorrection.deleteMany({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Overtime correction with id ${id} not found`);
    }
  }

  /**
   * How many people still wait for the open month's approval — the sidebar
   * badge. Someone whose hours moved after they were approved waits again.
   */
  async countPendingApprovals(): Promise<OvertimeApprovalsPendingResponse> {
    const monthStart = latestSettleableMonth();
    const lines = await this.buildSettlementLines(monthStart, {});

    return {
      month: formatMonth(monthStart),
      count: lines.filter(({ dto }) => isOvertimeLineAwaitingApproval(dto)).length,
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
      pendingLines
        .map((line) => line.dto)
        .filter(isOvertimeLineAwaitingApproval)
        .map((line) => [line.person.id, line]),
    );
    const today = todayWorkDate();

    const lines: AccountingTimesheetLineDto[] = persons.map((person) => {
      const days = source.daysByPerson.get(person.id) ?? [];
      const loggedByDay = new Map(
        days.map((day) => [workDateToDayKey(day.workDate), day.loggedMinutes]),
      );
      const leaveByDay =
        source.leaveTypesByPersonDay.get(person.id) ?? new Map<string, LeaveType>();
      // The hours were worked whatever the balance was corrected to, so the
      // normal/overtime split reads them as they were logged.
      const activity = this.monthlyActivity(person.id, source, null).get(monthKey) ?? NO_ACTIVITY;
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

      // A line waits while its settlement is missing or its hours moved since
      // the approval; a month whose approvals have not opened waits as a
      // whole, and one with nothing to settle is ready.
      const waiting = !settlementOpen || pending !== null;
      const status = exportRow ? 'EXPORTAT' : waiting ? 'IN_PREGATIRE' : 'GATA_EXPORT';

      return {
        person: toBalancePerson(person),
        isExternal,
        isAutoPresent,
        loggedMinutes,
        ...split,
        saturdaysWorked: activity.saturdaysWorked,
        dayCodes,
        missingWorkingDays,
        pendingBalanceMinutes: pending
          ? pending.settledAt === null
            ? pending.balanceMinutes
            : pending.changeSinceApprovalMinutes
          : null,
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
   * nothing and would only make the month look busier than it was — unless
   * they were approved already.
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
  ): Promise<SettlementLine[]> {
    const monthKey = formatMonth(monthStart);
    const [persons, settlements, source] = await Promise.all([
      this.listPersons(),
      this.prisma.overtimeSettlement.findMany({
        where: { month: { lte: monthStart } },
        select: { personId: true, ...SETTLEMENT_SELECT },
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
    const lines: SettlementLine[] = [];

    for (const person of persons) {
      if (wanted && !wanted.has(person.id)) {
        continue;
      }

      const settled = settledByPerson.get(person.id) ?? null;

      // A correction made after this month replaced its balance: nothing is
      // left to approve. A month approved before the correction stays as it was.
      const latestCorrection = source.correctionByPerson.get(person.id) ?? null;
      const correctedLater =
        latestCorrection !== null && formatMonth(latestCorrection.effectiveDate) > monthKey;
      if (correctedLater && !settled) {
        continue;
      }
      const correction = correctedLater ? null : latestCorrection;

      const activity = this.monthlyActivity(person.id, source, correction);
      const carryIn = this.carriedInFor(
        settlementsByPerson.get(person.id) ?? [],
        activity,
        monthKey,
        correction,
      );
      const carriedInMinutes = carryIn.minutes;
      const month = activity.get(monthKey) ?? NO_ACTIVITY;
      const balanceMinutes = carriedInMinutes + month.earnedMinutes - month.usedMinutes;

      // An approved line stays even once its balance came back to nothing, so
      // the change since the approval can still be seen and approved.
      if (!settled && balanceMinutes === 0 && carriedInMinutes === 0) {
        continue;
      }

      const storedReserve = Math.max(settled?.carriedOutMinutes ?? 0, 0);
      const reserveMinutes = Math.max(reserveMinutesByPerson[person.id] ?? storedReserve, 0);
      const { paidMinutes, carriedOutMinutes } = settleOvertimeBalance(
        balanceMinutes,
        reserveMinutes,
      );

      // Hours logged or corrected after the approval move the balance away
      // from what was approved. A correction made since replaced them.
      const changeSinceApprovalMinutes =
        settled && !isSupersededBy(settled, latestCorrection)
          ? balanceMinutes -
            (settled.carriedInMinutes + settled.earnedMinutes - settled.usedMinutes)
          : 0;

      const lastApproval = correctedLater ? null : carryIn.lastApproval;
      const previousApprovalMoved =
        lastApproval !== null &&
        (lastApproval.live.earnedMinutes !== lastApproval.row.earnedMinutes ||
          lastApproval.live.usedMinutes !== lastApproval.row.usedMinutes);

      lines.push({
        dto: {
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
          approvedPaidMinutes: settled?.paidMinutes ?? null,
          changeSinceApprovalMinutes,
        },
        previousApproval:
          lastApproval && previousApprovalMoved
            ? {
                month: lastApproval.row.month,
                earnedMinutes: lastApproval.live.earnedMinutes,
                usedMinutes: lastApproval.live.usedMinutes,
                carriedOutMinutes: approvedMonthCarry(lastApproval.row, lastApproval.live),
              }
            : null,
      });
    }

    return lines;
  }

  private buildBalance(
    personId: string,
    settlements: SettlementRow[],
    activity: Map<string, MonthActivity>,
    dailyWorkMinutes: number,
    correction: OvertimeCorrectionRow | null,
  ): OvertimeBalanceDto {
    const currentMonth = startOfMonth(new Date());
    const monthKey = formatMonth(currentMonth);
    const month = activity.get(monthKey) ?? NO_ACTIVITY;

    // Approved before it ended, the month has paid part of its hours already:
    // the person keeps what the approval carried, plus whatever came after it.
    const approvedNow =
      settlements.find(
        (row) => formatMonth(row.month) === monthKey && !isSupersededBy(row, correction),
      ) ?? null;
    const carriedInMinutes = approvedNow
      ? approvedNow.carriedInMinutes
      : this.carriedInFor(settlements, activity, monthKey, correction).minutes;
    const paidMinutes = approvedNow?.paidMinutes ?? 0;
    const remainingMinutes =
      carriedInMinutes + month.earnedMinutes - month.usedMinutes - paidMinutes;

    const lastSettled = latestMonth(settlements);

    return {
      personId,
      month: monthKey,
      carriedInMinutes,
      earnedMinutes: month.earnedMinutes,
      usedMinutes: month.usedMinutes,
      saturdaysWorked: month.saturdaysWorked,
      paidMinutes,
      remainingMinutes,
      remainingDays: overtimeDaysAvailable(Math.max(0, remainingMinutes), dailyWorkMinutes),
      settledThroughMonth: lastSettled ? formatMonth(lastSettled) : null,
      correction: correction ? toCorrectionDto(correction) : null,
    };
  }

  /**
   * What `monthKey` starts from: what the last settlement before it carried
   * on, plus every month between then and now that was never settled. A
   * settlement that was skipped costs accuracy on old data, never minutes.
   *
   * That last settlement is read with its hours as they stand now, so what
   * was logged or corrected in its month after the approval rides along
   * instead of being lost. Older settlements are taken as they were approved.
   *
   * A correction is a fresh start: settlements before it no longer count, and
   * until one is made after it, it is what the months carry from.
   */
  private carriedInFor(
    allSettlements: SettlementRow[],
    activity: Map<string, MonthActivity>,
    monthKey: string,
    correction: OvertimeCorrectionRow | null,
  ): CarryIn {
    let settlements = allSettlements.filter((row) => formatMonth(row.month) < monthKey);
    if (correction) {
      const correctionKey = formatMonth(correction.effectiveDate);
      if (correctionKey === monthKey) {
        return { minutes: correction.balanceMinutes, lastApproval: null };
      }
      if (correctionKey < monthKey) {
        settlements = settlements.filter(
          (row) => formatMonth(row.month) >= correctionKey && !isSupersededBy(row, correction),
        );
        if (settlements.length === 0) {
          return {
            minutes:
              correction.balanceMinutes +
              sumMonths(activity, (key) => key >= correctionKey && key < monthKey),
            lastApproval: null,
          };
        }
      }
    }

    const lastSettled = latestSettlement(settlements);
    if (!lastSettled) {
      return { minutes: sumMonths(activity, (key) => key < monthKey), lastApproval: null };
    }

    const lastSettledKey = formatMonth(lastSettled.month);
    const live = activity.get(lastSettledKey) ?? NO_ACTIVITY;
    return {
      minutes:
        approvedMonthCarry(lastSettled, live) +
        sumMonths(activity, (key) => key > lastSettledKey && key < monthKey),
      lastApproval: { row: lastSettled, live },
    };
  }

  /**
   * One person's timesheets and RECUPERARE, folded into a figure per month.
   * With a correction, days before it earn nothing — the correction stands in
   * for them. Saturdays worked are counted either way.
   */
  private monthlyActivity(
    personId: string,
    source: OvertimeSourceData,
    correction: OvertimeCorrectionRow | null,
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

    const dailyWorkMinutes = dailyWorkMinutesFor(source, personId);
    const daysByMonth = groupBy(source.daysByPerson.get(personId) ?? [], (day) =>
      formatMonth(day.workDate),
    );
    const counted = (day: DatedOvertimeDay) =>
      !correction || day.workDate.getTime() >= correction.effectiveDate.getTime();
    for (const [key, days] of daysByMonth) {
      const month = entry(key);
      month.earnedMinutes = overtimeBalanceMinutes(days.filter(counted), dailyWorkMinutes);
      month.saturdaysWorked = countSaturdaysWorked(days);
    }

    const correctionDayKey = correction ? workDateToDayKey(correction.effectiveDate) : null;
    for (const [dayKey, minutes] of source.usedByPersonDay.get(personId) ?? []) {
      if (correctionDayKey === null || dayKey >= correctionDayKey) {
        entry(dayKey.slice(0, 7)).usedMinutes += minutes;
      }
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

    const [dailyTotals, approvedLeave, norms, corrections] = await Promise.all([
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
      this.prisma.person.findMany({
        where: {
          dailyWorkMinutes: { not: null },
          ...(scope.personId ? { id: scope.personId } : {}),
        },
        select: { id: true, dailyWorkMinutes: true },
      }),
      this.prisma.overtimeCorrection.findMany({
        where: personFilter,
        select: CORRECTION_SELECT,
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const correctionByPerson = new Map<string, OvertimeCorrectionRow>();
    for (const { personId, ...correction } of corrections) {
      if (!correctionByPerson.has(personId)) {
        correctionByPerson.set(personId, correction);
      }
    }

    const dailyWorkMinutesByPerson = new Map(
      norms.map((row) => [row.id, dailyWorkMinutesOf(row.dailyWorkMinutes)]),
    );
    const normSource = { dailyWorkMinutesByPerson };

    // Any approved leave covers a day; only RECUPERARE spends the balance.
    const leaveRequestsByPerson = new Map<string, ApprovedLeave[]>();
    const usedByPersonDay = new Map<string, Map<string, number>>();
    for (const request of approvedLeave) {
      const requests = leaveRequestsByPerson.get(request.personId) ?? [];
      requests.push(request);
      leaveRequestsByPerson.set(request.personId, requests);

      if (request.type === 'RECUPERARE') {
        const byDay = usedByPersonDay.get(request.personId) ?? new Map();
        // Hours are taken on startDate; whole days spread over the days they
        // cover, so a request crossing a month boundary lands on both months.
        const dailyWorkMinutes = dailyWorkMinutesFor(normSource, request.personId);
        for (const [dayKey, minutes] of leaveMinutesByDay([request], dailyWorkMinutes)) {
          addTo(byDay, dayKey, minutes);
        }
        usedByPersonDay.set(request.personId, byDay);
      }
    }

    const leaveDaysByPerson = new Map<string, Map<string, number>>();
    const leaveTypesByPersonDay = new Map<string, Map<string, LeaveType>>();
    for (const [personId, requests] of leaveRequestsByPerson) {
      leaveDaysByPerson.set(
        personId,
        leaveMinutesByDay(requests, dailyWorkMinutesFor(normSource, personId)),
      );
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

    return {
      daysByPerson,
      usedByPersonDay,
      leaveTypesByPersonDay,
      dailyWorkMinutesByPerson,
      correctionByPerson,
    };
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

function toCorrectionDto(correction: OvertimeCorrectionRow): OvertimeCorrectionDto {
  return {
    id: correction.id,
    effectiveDate: workDateToDayKey(correction.effectiveDate),
    balanceMinutes: correction.balanceMinutes,
    previousBalanceMinutes: correction.previousBalanceMinutes,
    note: correction.note,
    createdAt: correction.createdAt.toISOString(),
    createdBy: correction.createdBy?.person ?? null,
  };
}

/** A person without a login is on the payroll like anyone else; external is an explicit flag. */
function isExternalPerson(person: PersonRow): boolean {
  return person.user?.angajatExtern ?? false;
}

/** A person's working day, from the norms loaded with the overtime source. */
function dailyWorkMinutesFor(
  source: Pick<OvertimeSourceData, 'dailyWorkMinutesByPerson'>,
  personId: string,
): number {
  return dailyWorkMinutesOf(source.dailyWorkMinutesByPerson.get(personId));
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

function latestSettlement<T extends { month: Date }>(rows: T[]): T | null {
  return rows.reduce<T | null>(
    (latest, row) => (!latest || row.month > latest.month ? row : latest),
    null,
  );
}

/** earned − used over the months `include` picks. */
function sumMonths(
  activity: Map<string, MonthActivity>,
  include: (monthKey: string) => boolean,
): number {
  let minutes = 0;
  for (const [key, month] of activity) {
    if (include(key)) {
      minutes += month.earnedMinutes - month.usedMinutes;
    }
  }
  return minutes;
}

/** A balance set by hand after an approval replaces whatever that approval left. */
function isSupersededBy(
  settlement: { settledAt: Date },
  correction: OvertimeCorrectionRow | null,
): boolean {
  return correction !== null && correction.createdAt.getTime() > settlement.settledAt.getTime();
}

/**
 * How far back the timesheet scan has to reach: the earliest last-settled
 * month across everyone, which is read again for what moved in it after its
 * approval. Anyone never settled pulls it back to the beginning, because their
 * whole history still has to be recomputed.
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

    const start = new Date(lastSettled.getFullYear(), lastSettled.getMonth(), 1);
    if (!earliest || start < earliest) {
      earliest = start;
    }
  }

  return earliest ? { from: earliest } : {};
}
