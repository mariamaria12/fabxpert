import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DAILY_WORK_MINUTES } from '@fabxpert/shared/overtime';
import { isWorkingDate, normalizeWorkDate, todayWorkDate } from '@fabxpert/shared/workDate';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { FIXTURES, E2E_PASSWORD } from './helpers/fixtures';

/** A working day of this month that is already over; null on the month's first working day. */
function pastWorkingDayThisMonth(): Date | null {
  const today = todayWorkDate();
  for (let day = 1; day < today.getDate(); day += 1) {
    const date = normalizeWorkDate(new Date(today.getFullYear(), today.getMonth(), day));
    if (isWorkingDate(date)) {
      return date;
    }
  }
  return null;
}

describe('Per-person daily norm (e2e)', () => {
  const personId = FIXTURES.persons.employee1.id;
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
    employeeCookie = (await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD))
      .cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it('a person without a norm is on the default 9h day', async () => {
    const person = await request(app.getHttpServer())
      .get(`/persons/${personId}`)
      .set(authHeader(adminCookie));
    expect(person.status).toBe(200);
    expect(person.body.dailyWorkMinutes).toBeNull();

    const balance = await request(app.getHttpServer())
      .get('/leave-requests/my-balance')
      .set(authHeader(employeeCookie));
    expect(balance.status).toBe(200);
    expect(balance.body.dailyWorkMinutes).toBe(DAILY_WORK_MINUTES);
  });

  it('admin sets a norm; one outside 1h–12h is refused', async () => {
    for (const dailyWorkMinutes of [30, 800]) {
      const refused = await request(app.getHttpServer())
        .patch(`/persons/${personId}`)
        .set(authHeader(adminCookie))
        .send({ dailyWorkMinutes });
      expect(refused.status).toBe(400);
    }

    const saved = await request(app.getHttpServer())
      .patch(`/persons/${personId}`)
      .set(authHeader(adminCookie))
      .send({ dailyWorkMinutes: 360 });
    expect(saved.status).toBe(200);
    expect(saved.body.dailyWorkMinutes).toBe(360);

    const balance = await request(app.getHttpServer())
      .get('/leave-requests/my-balance')
      .set(authHeader(employeeCookie));
    expect(balance.body.dailyWorkMinutes).toBe(360);
  });

  it('overtime is measured against the norm, and clearing it goes back to 9h', async () => {
    const workDate = pastWorkingDayThisMonth();
    if (!workDate) {
      // First working day of the month: no finished day to measure yet.
      return;
    }

    const prisma = getTestPrisma();
    await prisma.timesheet.deleteMany({ where: { personId } });
    await prisma.timesheet.create({
      data: {
        personId,
        userId: FIXTURES.users.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        workDate,
        durationMinutes: 420,
      },
    });

    // 7h on a 6h contract is one hour over.
    const onNorm = await request(app.getHttpServer())
      .get(`/overtime/balance/${personId}`)
      .set(authHeader(adminCookie));
    expect(onNorm.status).toBe(200);
    expect(onNorm.body.earnedMinutes).toBe(60);

    const cleared = await request(app.getHttpServer())
      .patch(`/persons/${personId}`)
      .set(authHeader(adminCookie))
      .send({ dailyWorkMinutes: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.dailyWorkMinutes).toBeNull();

    // The same 7h on the default 9h day is two hours short.
    const onDefault = await request(app.getHttpServer())
      .get(`/overtime/balance/${personId}`)
      .set(authHeader(adminCookie));
    expect(onDefault.body.earnedMinutes).toBe(420 - DAILY_WORK_MINUTES);
  });
});
