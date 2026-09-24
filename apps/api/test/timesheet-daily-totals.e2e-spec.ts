import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { FIXTURES, E2E_PASSWORD } from './helpers/fixtures';

describe('Timesheet daily totals (e2e)', () => {
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
          workDate: new Date(2031, 5, day),
          durationMinutes,
        },
      });

    // 2 June: two entries for one person, one for the other. 3 June: one person.
    await log(employee1, FIXTURES.users.employee1.id, 2, 240);
    await log(employee1, FIXTURES.users.employee1.id, 2, 300);
    await log(employee2, FIXTURES.users.employee2.id, 2, 480);
    await log(employee2, FIXTURES.users.employee2.id, 3, 60);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sums people and minutes per day over the period', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/daily-totals?period=custom&from=2031-06-01&to=2031-06-30')
      .set(authHeader(adminCookie));

    expect(response.status).toBe(200);
    expect(response.body.days).toEqual([
      { date: '2031-06-02', people: 2, minutes: 1020 },
      { date: '2031-06-03', people: 1, minutes: 60 },
    ]);
  });

  it('is for admins only', async () => {
    const employeeCookie = (await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD))
      .cookieHeader;
    const response = await request(app.getHttpServer())
      .get('/timesheets/daily-totals?period=custom&from=2031-06-01&to=2031-06-30')
      .set(authHeader(employeeCookie));
    expect(response.status).toBe(403);
  });
});
