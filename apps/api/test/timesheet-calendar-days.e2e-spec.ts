import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { FIXTURES, E2E_PASSWORD } from './helpers/fixtures';

describe('Timesheet calendar days (e2e)', () => {
  const employee1 = FIXTURES.persons.employee1.id;
  const employee2 = FIXTURES.persons.employee2.id;
  let app: INestApplication;
  let adminCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;

    const prisma = getTestPrisma();
    await prisma.timesheet.deleteMany({ where: { personId: { in: [employee1, employee2] } } });
    const log = (personId: string, userId: string, day: number, durationMinutes: number) =>
      prisma.timesheet.create({
        data: {
          personId,
          userId,
          projectId: FIXTURES.projects.ready.id,
          workDate: new Date(2031, 6, day),
          durationMinutes,
        },
      });

    await log(employee1, FIXTURES.users.employee1.id, 7, 240);
    await log(employee1, FIXTURES.users.employee1.id, 7, 300);
    await log(employee2, FIXTURES.users.employee2.id, 8, 480);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns one total per person per day, without entries', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/calendar-days?period=custom&from=2031-07-01&to=2031-07-31')
      .set(authHeader(adminCookie));

    expect(response.status).toBe(200);
    const days = (response.body.days as {
      person: { id: string };
      workDate: string;
      totalMinutes: number;
      entryCount: number;
    }[]).sort((a, b) => a.workDate.localeCompare(b.workDate));

    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({
      person: { id: employee1 },
      workDate: '2031-07-07',
      totalMinutes: 540,
      entryCount: 2,
    });
    expect(days[1]).toMatchObject({
      person: { id: employee2 },
      workDate: '2031-07-08',
      totalMinutes: 480,
      entryCount: 1,
    });
    expect(days[0]).not.toHaveProperty('entries');
  });

  it('filters by person name', async () => {
    const person = await getTestPrisma().person.findUniqueOrThrow({ where: { id: employee2 } });
    const response = await request(app.getHttpServer())
      .get(
        `/timesheets/calendar-days?period=custom&from=2031-07-01&to=2031-07-31&search=${encodeURIComponent(person.lastName)}`,
      )
      .set(authHeader(adminCookie));

    expect(response.status).toBe(200);
    expect(
      (response.body.days as { person: { id: string } }[]).every(
        (day) => day.person.id === employee2,
      ),
    ).toBe(true);
  });
});
