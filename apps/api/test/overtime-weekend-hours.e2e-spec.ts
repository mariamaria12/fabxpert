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

describe('Overtime weekend hours (e2e)', () => {
  const personId = FIXTURES.persons.employee1.id;
  const workingDay = firstDayLastMonth(isWorkingDate);
  const saturday = firstDayLastMonth((date) => date.getDay() === 6);
  const sunday = firstDayLastMonth((date) => date.getDay() === 0);
  let app: INestApplication;
  let adminCookie: string;

  const logDay = (workDate: Date, durationMinutes: number) =>
    getTestPrisma().timesheet.create({
      data: {
        personId,
        userId: FIXTURES.users.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        workDate,
        durationMinutes,
      },
    });

  const previewLine = async () => {
    const response = await request(app.getHttpServer())
      .get(`/overtime/settlement-preview?month=${lastMonthKey()}`)
      .set(authHeader(adminCookie));
    expect(response.status).toBe(200);
    return response.body.lines.find(
      (line: { person: { id: string } }) => line.person.id === personId,
    );
  };

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
    await prisma.overtimeSettlement.deleteMany();
    await prisma.timesheet.deleteMany({ where: { personId } });

    // 10h on a working day, 9h on a Saturday, 4h on a Sunday.
    await logDay(workingDay, 600);
    await logDay(saturday, 540);
    await logDay(sunday, 240);
  });

  afterAll(async () => {
    await app.close();
  });

  it('weekend hours stay out of the balance and are counted as logged', async () => {
    const line = await previewLine();
    // Only the hour past the 9h norm on the working day.
    expect(line.earnedMinutes).toBe(60);
    expect(line.balanceMinutes).toBe(60);
    expect(line.saturdaysWorked).toBe(1);
    expect(line.saturdayMinutes).toBe(540);
    expect(line.sundayMinutes).toBe(240);

    expect((await approve()).status).toBe(200);
    const row = await settlementRow();
    expect(row.paidMinutes).toBe(60);
    expect(row.weekendApart).toBe(true);
  });

  it('the pontaj for accounting lists them apart from normal hours, day by day', async () => {
    const response = await request(app.getHttpServer())
      .get(`/overtime/accounting?month=${lastMonthKey()}`)
      .set(authHeader(adminCookie));
    expect(response.status).toBe(200);

    const line = response.body.lines.find(
      (candidate: { person: { id: string } }) => candidate.person.id === personId,
    );
    expect(line.loggedMinutes).toBe(1380);
    // 10h on the working day, less the hour of overtime it produced.
    expect(line.normalMinutes).toBe(540);
    expect(line.saturdayMinutes).toBe(540);
    expect(line.sundayMinutes).toBe(240);
    expect(line.weekendDayMinutes[saturday.getDate() - 1]).toBe(540);
    expect(line.weekendDayMinutes[sunday.getDate() - 1]).toBe(240);
    expect(line.weekendDayMinutes[workingDay.getDate() - 1]).toBe(0);
    expect(line.dayCodes[saturday.getDate() - 1]).toBe('');
  });

  it('a month approved with the weekend in the balance keeps that reading', async () => {
    await getTestPrisma().overtimeSettlement.create({
      data: {
        personId,
        month: lastMonthStart(),
        earnedMinutes: 390,
        paidMinutes: 390,
        weekendApart: false,
      },
    });

    const line = await previewLine();
    // The hour on the working day, 1h30 past 7.5h on the Saturday, all of the Sunday.
    expect(line.earnedMinutes).toBe(390);
    expect(line.changeSinceApprovalMinutes).toBe(0);
    expect(line.saturdayMinutes).toBeNull();
    expect(line.sundayMinutes).toBeNull();

    // Approving it again does not move it onto the new reading.
    expect((await approve()).status).toBe(200);
    const row = await settlementRow();
    expect(row.paidMinutes).toBe(390);
    expect(row.weekendApart).toBe(false);
  });
});
