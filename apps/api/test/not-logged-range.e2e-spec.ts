import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  isWorkingDate,
  normalizeWorkDate,
  todayWorkDate,
  workDateToDayKey,
} from '@fabxpert/shared/workDate';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { FIXTURES, E2E_PASSWORD } from './helpers/fixtures';

/** The first five working days of last month — all over, whatever today is. */
function lastMonthWorkingDays(): Date[] {
  const today = todayWorkDate();
  const cursor = normalizeWorkDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const days: Date[] = [];
  while (days.length < 5) {
    if (isWorkingDate(cursor)) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

describe('Not logged over a range (e2e)', () => {
  const employee1 = FIXTURES.persons.employee1.id;
  const employee2 = FIXTURES.persons.employee2.id;
  const days = lastMonthWorkingDays();
  let app: INestApplication;
  let adminCookie: string;

  const logDay = (personId: string, userId: string, workDate: Date) =>
    getTestPrisma().timesheet.create({
      data: { personId, userId, projectId: FIXTURES.projects.ready.id, workDate, durationMinutes: 540 },
    });

  const notLogged = async (from: Date, to: Date) => {
    const response = await request(app.getHttpServer())
      .get(
        `/timesheets/not-logged?period=custom&from=${workDateToDayKey(from)}&to=${workDateToDayKey(to)}`,
      )
      .set(authHeader(adminCookie));
    expect(response.status).toBe(200);
    return response.body.persons as { id: string; missingDays: string[] }[];
  };

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;

    const prisma = getTestPrisma();
    await prisma.timesheet.deleteMany({ where: { personId: { in: [employee1, employee2] } } });
    await prisma.leaveRequest.deleteMany({ where: { personId: { in: [employee1, employee2] } } });

    // employee1 logs the first day only and is on leave the second.
    await logDay(employee1, FIXTURES.users.employee1.id, days[0]);
    await prisma.leaveRequest.create({
      data: {
        personId: employee1,
        type: 'ODIHNA',
        startDate: days[1],
        endDate: days[1],
        status: 'APROBAT',
      },
    });
    // employee2 logs every day.
    for (const day of days) {
      await logDay(employee2, FIXTURES.users.employee2.id, day);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists someone who missed some days of the range, with those days', async () => {
    const persons = await notLogged(days[0], days[4]);

    const first = persons.find((person) => person.id === employee1);
    expect(first?.missingDays).toEqual(days.slice(2).map(workDateToDayKey));
    expect(persons.find((person) => person.id === employee2)).toBeUndefined();
  });

  it('leaves out someone whose only gap is a day on leave', async () => {
    const persons = await notLogged(days[0], days[1]);
    expect(persons.find((person) => person.id === employee1)).toBeUndefined();
  });

  it('agrees with the count on the metric card', async () => {
    const persons = await notLogged(days[0], days[4]);
    const metrics = await request(app.getHttpServer())
      .get(
        `/timesheets/dashboard-metrics?period=custom&from=${workDateToDayKey(days[0])}&to=${workDateToDayKey(days[4])}`,
      )
      .set(authHeader(adminCookie));
    expect(metrics.status).toBe(200);
    expect(metrics.body.notLoggedPersonCount).toBe(persons.length);
  });
});
