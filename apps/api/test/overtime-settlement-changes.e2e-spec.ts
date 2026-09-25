import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { isMonthSettleable } from '@fabxpert/shared/overtime';
import { isWorkingDate, normalizeWorkDate, todayWorkDate } from '@fabxpert/shared/workDate';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function monthStart(offset: number): Date {
  const today = todayWorkDate();
  return new Date(today.getFullYear(), today.getMonth() + offset, 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Working days of the month, from its first day, stopping before `until` when given. */
function workingDaysOf(month: Date, until?: Date): Date[] {
  const days: Date[] = [];
  const cursor = normalizeWorkDate(month);
  while (cursor.getMonth() === month.getMonth() && (!until || cursor < until)) {
    if (isWorkingDate(cursor)) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

type SettlementLine = {
  person: { id: string };
  balanceMinutes: number;
  paidMinutes: number;
  carriedInMinutes: number;
  settledAt: string | null;
  approvedPaidMinutes: number | null;
  changeSinceApprovalMinutes: number;
};

describe('Overtime settlement after the approval (e2e)', () => {
  const personId = FIXTURES.persons.employee1.id;
  let app: INestApplication;
  let adminCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
  });

  beforeEach(async () => {
    const prisma = getTestPrisma();
    await prisma.overtimeCorrection.deleteMany();
    await prisma.overtimeSettlement.deleteMany();
    await prisma.timesheet.deleteMany({ where: { personId } });
  });

  afterAll(async () => {
    await app.close();
  });

  /** 11h on the default 9h day: +2h each. */
  const logLongDay = (workDate: Date) =>
    getTestPrisma().timesheet.create({
      data: {
        personId,
        userId: FIXTURES.users.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        workDate,
        durationMinutes: 660,
      },
    });

  const balance = async () => {
    const response = await request(app.getHttpServer())
      .get(`/overtime/balance/${personId}`)
      .set(authHeader(adminCookie))
      .expect(200);
    return response.body;
  };

  const lineFor = async (month: string): Promise<SettlementLine | undefined> => {
    const response = await request(app.getHttpServer())
      .get(`/overtime/settlement-preview?month=${month}`)
      .set(authHeader(adminCookie))
      .expect(200);
    return (response.body.lines as SettlementLine[]).find((line) => line.person.id === personId);
  };

  const settle = (month: string, reserveMinutes?: number) =>
    request(app.getHttpServer())
      .post('/overtime/settle-month')
      .set(authHeader(adminCookie))
      .send({
        month,
        personIds: [personId],
        ...(reserveMinutes === undefined
          ? {}
          : { reserveMinutesByPerson: { [personId]: reserveMinutes } }),
      })
      .expect(200);

  const storedSettlement = (month: Date) =>
    getTestPrisma().overtimeSettlement.findUniqueOrThrow({
      where: { personId_month: { personId, month } },
    });

  // The current month can only be approved in its last week.
  const currentMonthSettleable = isMonthSettleable(monthStart(0));

  (currentMonthSettleable ? it : it.skip)(
    'an early approval leaves only what was kept, and hours logged after it wait for reapproval',
    async () => {
      const current = monthKey(monthStart(0));
      const pastDays = workingDaysOf(monthStart(0), todayWorkDate());
      await logLongDay(pastDays[0]);
      await logLongDay(pastDays[1]);

      // +4h, 1h kept: 3h paid, 1h left.
      await settle(current, 60);
      const approved = await balance();
      expect(approved.paidMinutes).toBe(180);
      expect(approved.remainingMinutes).toBe(60);

      // Two more hours land in the approved month.
      await logLongDay(pastDays[2]);
      expect((await balance()).remainingMinutes).toBe(180);

      const changed = await lineFor(current);
      expect(changed?.settledAt).not.toBeNull();
      expect(changed?.approvedPaidMinutes).toBe(180);
      expect(changed?.changeSinceApprovalMinutes).toBe(120);

      const pending = await request(app.getHttpServer())
        .get('/overtime/approvals-pending-count')
        .set(authHeader(adminCookie))
        .expect(200);
      expect(pending.body.count).toBeGreaterThanOrEqual(1);

      const accounting = await request(app.getHttpServer())
        .get(`/overtime/accounting?month=${current}`)
        .set(authHeader(adminCookie))
        .expect(200);
      const accountingLine = accounting.body.lines.find(
        (line: { person: { id: string } }) => line.person.id === personId,
      );
      expect(accountingLine.status).toBe('IN_PREGATIRE');
      expect(accountingLine.pendingBalanceMinutes).toBe(120);

      // The reapproval pays the new hours and keeps the same 1h.
      await settle(current, 60);
      expect((await storedSettlement(monthStart(0))).paidMinutes).toBe(300);
      expect((await lineFor(current))?.changeSinceApprovalMinutes).toBe(0);
      expect((await balance()).remainingMinutes).toBe(60);
    },
  );

  it('hours added to an approved month carry on, and the next approval takes them on once', async () => {
    const twoMonthsAgo = monthStart(-2);
    const lastMonth = monthStart(-1);
    const days = workingDaysOf(twoMonthsAgo);
    await logLongDay(days[0]);
    await logLongDay(days[1]);

    await settle(monthKey(twoMonthsAgo), 60);
    // Logged after the approval: never paid, so it has to travel on.
    await logLongDay(days[2]);

    const carried = await balance();
    expect(carried.carriedInMinutes).toBe(180);
    expect(carried.paidMinutes).toBe(0);
    expect((await lineFor(monthKey(twoMonthsAgo)))?.changeSinceApprovalMinutes).toBe(120);
    expect((await lineFor(monthKey(lastMonth)))?.carriedInMinutes).toBe(180);

    // Approving last month pays the carry, and the month before carries it too.
    await settle(monthKey(lastMonth));
    const previous = await storedSettlement(twoMonthsAgo);
    expect(previous.paidMinutes).toBe(180);
    expect(previous.carriedOutMinutes).toBe(180);
    expect((await storedSettlement(lastMonth)).paidMinutes).toBe(180);
    expect((await lineFor(monthKey(twoMonthsAgo)))?.changeSinceApprovalMinutes).toBe(0);

    // Approving the earlier month again pays nothing twice.
    await settle(monthKey(twoMonthsAgo));
    expect((await storedSettlement(twoMonthsAgo)).paidMinutes).toBe(180);
    expect((await balance()).carriedInMinutes).toBe(0);
  });

  it('lists everyone for a past month as it stands, and refuses a future one', async () => {
    const lastMonth = monthStart(-1);
    const days = workingDaysOf(lastMonth);
    await logLongDay(days[0]);
    await logLongDay(days[1]);

    const balanceIn = async (month?: string) => {
      const response = await request(app.getHttpServer())
        .get(`/overtime/balances${month ? `?month=${month}` : ''}`)
        .set(authHeader(adminCookie))
        .expect(200);
      return response.body.rows.find(
        (row: { person: { id: string } }) => row.person.id === personId,
      ).balance;
    };

    const unapproved = await balanceIn(monthKey(lastMonth));
    expect(unapproved.month).toBe(monthKey(lastMonth));
    expect(unapproved.earnedMinutes).toBe(240);
    expect(unapproved.remainingMinutes).toBe(240);

    await settle(monthKey(lastMonth), 60);
    const approved = await balanceIn(monthKey(lastMonth));
    expect(approved.paidMinutes).toBe(180);
    expect(approved.remainingMinutes).toBe(60);
    expect((await balanceIn()).carriedInMinutes).toBe(60);

    // A correction made today replaces the balance from here on, not last month's figures.
    await request(app.getHttpServer())
      .post('/overtime/corrections')
      .set(authHeader(adminCookie))
      .send({ personId, balanceMinutes: 0 })
      .expect(201);
    expect((await balanceIn(monthKey(lastMonth))).earnedMinutes).toBe(240);
    expect((await balanceIn()).remainingMinutes).toBe(0);

    await request(app.getHttpServer())
      .get(`/overtime/balances?month=${monthKey(monthStart(1))}`)
      .set(authHeader(adminCookie))
      .expect(400);
  });

  it('a correction made after an approval replaces what moved in that month', async () => {
    const twoMonthsAgo = monthStart(-2);
    const days = workingDaysOf(twoMonthsAgo);
    await logLongDay(days[0]);
    await settle(monthKey(twoMonthsAgo), 60);
    await logLongDay(days[1]);

    await request(app.getHttpServer())
      .post('/overtime/corrections')
      .set(authHeader(adminCookie))
      .send({ personId, balanceMinutes: 0 })
      .expect(201);

    expect((await balance()).remainingMinutes).toBe(0);
    expect((await lineFor(monthKey(twoMonthsAgo)))?.changeSinceApprovalMinutes).toBe(0);
  });
});
