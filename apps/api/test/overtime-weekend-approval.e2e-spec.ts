import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { isWorkingDate, normalizeWorkDate, todayWorkDate } from '@fabxpert/shared/workDate';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { FIXTURES, E2E_PASSWORD } from './helpers/fixtures';

function lastMonthStart(): Date {
  const today = todayWorkDate();
  return normalizeWorkDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
}

function lastMonthKey(): string {
  const month = lastMonthStart();
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

/** First day of last month that `matches`. */
function firstDayLastMonth(matches: (date: Date) => boolean): Date {
  const cursor = lastMonthStart();
  while (!matches(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

type PersonLine = { person: { id: string } };

describe('Overtime approval of weekend hours and deactivated people (e2e)', () => {
  const personId = FIXTURES.persons.employee1.id;
  const userId = FIXTURES.users.employee1.id;
  const saturday = firstDayLastMonth((date) => date.getDay() === 6);
  const sunday = firstDayLastMonth((date) => date.getDay() === 0);
  const workingDay = firstDayLastMonth(isWorkingDate);
  let app: INestApplication;
  let adminCookie: string;

  const get = async (path: string) => {
    const response = await request(app.getHttpServer()).get(path).set(authHeader(adminCookie));
    expect(response.status).toBe(200);
    return response.body;
  };

  const previewLine = async () =>
    (await get(`/overtime/settlement-preview?month=${lastMonthKey()}`)).lines.find(
      (line: PersonLine) => line.person.id === personId,
    );

  const balanceRow = async () =>
    (await get(`/overtime/balances?month=${lastMonthKey()}`)).rows.find(
      (row: PersonLine) => row.person.id === personId,
    );

  const accountingLine = async () =>
    (await get(`/overtime/accounting?month=${lastMonthKey()}`)).lines.find(
      (line: PersonLine) => line.person.id === personId,
    );

  const logDay = (workDate: Date, durationMinutes: number) =>
    getTestPrisma().timesheet.create({
      data: {
        personId,
        userId,
        projectId: FIXTURES.projects.ready.id,
        workDate,
        durationMinutes,
      },
    });

  const approve = () =>
    request(app.getHttpServer())
      .post('/overtime/settle-month')
      .set(authHeader(adminCookie))
      .send({ month: lastMonthKey(), personIds: [personId] });

  const settlementRow = () =>
    getTestPrisma().overtimeSettlement.findUniqueOrThrow({
      where: { personId_month: { personId, month: lastMonthStart() } },
    });

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
  });

  beforeEach(async () => {
    const prisma = getTestPrisma();
    await prisma.overtimeCorrection.deleteMany();
    await prisma.overtimeWeekendCorrection.deleteMany();
    await prisma.overtimeSettlement.deleteMany();
    await prisma.timesheet.deleteMany({ where: { personId } });
    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
  });

  afterAll(async () => {
    await getTestPrisma().user.update({ where: { id: userId }, data: { isActive: true } });
    await app.close();
  });

  it('someone with nothing but a Saturday is on the approval list', async () => {
    await logDay(saturday, 450);

    const line = await previewLine();
    expect(line).toBeDefined();
    expect(line.balanceMinutes).toBe(0);
    expect(line.saturdayMinutes).toBe(450);
    expect(line.settledAt).toBeNull();

    const accounting = await accountingLine();
    expect(accounting.status).toBe('IN_PREGATIRE');
    expect(accounting.pendingBalanceMinutes).toBe(0);
    expect(accounting.pendingWeekendHours).toBe(true);

    expect((await approve()).status).toBe(200);
    const row = await settlementRow();
    expect(row.paidMinutes).toBe(0);
    expect(row.saturdayMinutes).toBe(450);
    expect(row.sundayMinutes).toBe(0);
    expect((await accountingLine()).status).toBe('GATA_EXPORT');
  });

  it('someone with nothing at all stays off it', async () => {
    // A plain 9h day: no overtime, no weekend.
    await logDay(workingDay, 540);
    expect(await previewLine()).toBeUndefined();
  });

  it('weekend hours that move after the approval wait to be approved again', async () => {
    await logDay(saturday, 450);
    expect((await approve()).status).toBe(200);

    const approved = await previewLine();
    expect(approved.saturdayChangeSinceApprovalMinutes).toBe(0);
    expect(approved.sundayChangeSinceApprovalMinutes).toBe(0);

    await logDay(sunday, 240);
    const moved = await previewLine();
    expect(moved.changeSinceApprovalMinutes).toBe(0);
    expect(moved.sundayChangeSinceApprovalMinutes).toBe(240);
    expect((await accountingLine()).status).toBe('IN_PREGATIRE');

    // A correction by hand moves them too.
    await request(app.getHttpServer())
      .put('/overtime/weekend-hours')
      .set(authHeader(adminCookie))
      .send({ personId, month: lastMonthKey(), saturdayMinutes: 420, sundayMinutes: null })
      .expect(204);
    expect((await previewLine()).saturdayChangeSinceApprovalMinutes).toBe(-30);

    expect((await approve()).status).toBe(200);
    const reapproved = await previewLine();
    expect(reapproved.saturdayChangeSinceApprovalMinutes).toBe(0);
    expect(reapproved.sundayChangeSinceApprovalMinutes).toBe(0);
    const row = await settlementRow();
    expect(row.saturdayMinutes).toBe(420);
    expect(row.sundayMinutes).toBe(240);
  });

  it('a month approved before weekend hours were recorded is not asked for again', async () => {
    await logDay(workingDay, 600);
    await logDay(saturday, 450);
    await getTestPrisma().overtimeSettlement.create({
      data: {
        personId,
        month: lastMonthStart(),
        earnedMinutes: 60,
        paidMinutes: 60,
        weekendApart: true,
      },
    });

    const line = await previewLine();
    expect(line.changeSinceApprovalMinutes).toBe(0);
    expect(line.saturdayChangeSinceApprovalMinutes).toBe(0);
    expect(line.sundayChangeSinceApprovalMinutes).toBe(0);
  });

  it('a balance corrected later leaves only the weekend hours to approve', async () => {
    await logDay(workingDay, 600);
    await logDay(saturday, 450);
    await getTestPrisma().overtimeCorrection.create({
      data: {
        personId,
        effectiveDate: todayWorkDate(),
        balanceMinutes: 0,
        previousBalanceMinutes: 60,
      },
    });

    const line = await previewLine();
    expect(line.balanceMinutes).toBe(0);
    expect(line.paidMinutes).toBe(0);
    expect(line.saturdayMinutes).toBe(450);

    expect((await approve()).status).toBe(200);
    const approved = await previewLine();
    expect(approved.balanceMinutes).toBe(0);
    expect(approved.changeSinceApprovalMinutes).toBe(0);
    expect((await settlementRow()).paidMinutes).toBe(0);
    // The month still reads with the hour it earned, not from the empty approval.
    expect((await balanceRow()).balance.earnedMinutes).toBe(60);
  });

  it('a month a correction replaced after its approval is not asked for again', async () => {
    await logDay(saturday, 450);
    expect((await approve()).status).toBe(200);
    await getTestPrisma().overtimeCorrection.create({
      data: {
        personId,
        effectiveDate: todayWorkDate(),
        balanceMinutes: 0,
        previousBalanceMinutes: 0,
      },
    });

    await logDay(sunday, 240);
    const line = await previewLine();
    expect(line.saturdayChangeSinceApprovalMinutes).toBe(0);
    expect(line.sundayChangeSinceApprovalMinutes).toBe(0);
  });

  it('a month skipped while a later one was approved is not offered again', async () => {
    const today = todayWorkDate();
    const twoMonthsAgo = normalizeWorkDate(new Date(today.getFullYear(), today.getMonth() - 2, 1));
    const twoMonthsAgoKey = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
    const earlyDay = new Date(twoMonthsAgo);
    while (!isWorkingDate(earlyDay)) {
      earlyDay.setDate(earlyDay.getDate() + 1);
    }
    // 2h of overtime two months ago, never approved; last month carries and pays them.
    await logDay(earlyDay, 660);
    expect((await previewLine()).carriedInMinutes).toBe(120);
    expect((await approve()).status).toBe(200);
    expect((await settlementRow()).paidMinutes).toBe(120);

    const older = (await get(`/overtime/settlement-preview?month=${twoMonthsAgoKey}`)).lines.find(
      (line: PersonLine) => line.person.id === personId,
    );
    expect(older).toBeUndefined();
  });

  it('weekend hours corrected by hand leave the normal hours alone', async () => {
    await logDay(workingDay, 540);
    await logDay(saturday, 480);
    await request(app.getHttpServer())
      .put('/overtime/weekend-hours')
      .set(authHeader(adminCookie))
      .send({ personId, month: lastMonthKey(), saturdayMinutes: 240, sundayMinutes: null })
      .expect(204);

    const line = await accountingLine();
    expect(line.saturdayMinutes).toBe(240);
    expect(line.normalMinutes).toBe(540);
  });

  it('a month read with the weekend in the balance writes no weekend hours on its days', async () => {
    await logDay(saturday, 540);
    await getTestPrisma().overtimeSettlement.create({
      data: {
        personId,
        month: lastMonthStart(),
        earnedMinutes: 90,
        paidMinutes: 90,
        weekendApart: false,
      },
    });

    const line = await accountingLine();
    expect(line.saturdayMinutes).toBeNull();
    expect(line.weekendDayMinutes[saturday.getDate() - 1]).toBe(0);
  });

  it('a list filter that cannot be read is refused, not dropped', async () => {
    const response = await request(app.getHttpServer())
      .get(`/timesheets?personId=${personId}&projectId=abc`)
      .set(authHeader(adminCookie));
    expect(response.status).toBe(400);
  });

  it('a deactivated person with nothing in the month leaves its lists', async () => {
    await getTestPrisma().user.update({ where: { id: userId }, data: { isActive: false } });

    expect(await balanceRow()).toBeUndefined();
    expect(await accountingLine()).toBeUndefined();
    expect(await previewLine()).toBeUndefined();
  });

  it('a deactivated person who worked in the month stays on them', async () => {
    await logDay(workingDay, 600);
    await getTestPrisma().user.update({ where: { id: userId }, data: { isActive: false } });

    expect(await balanceRow()).toBeDefined();
    expect(await accountingLine()).toBeDefined();
    expect((await previewLine()).balanceMinutes).toBe(60);
  });

  it('an active person with nothing in the month is still on the pontaj', async () => {
    const line = await accountingLine();
    expect(line).toBeDefined();
    expect(line.missingWorkingDays.length).toBeGreaterThan(0);
  });
});
