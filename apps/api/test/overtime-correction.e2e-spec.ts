import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

function firstWorkingDayLastMonth(): Date {
  const today = todayWorkDate();
  const cursor = normalizeWorkDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  while (!isWorkingDate(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

function lastMonthKey(): string {
  const today = todayWorkDate();
  const month = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

describe('Overtime correction (e2e)', () => {
  const personId = FIXTURES.persons.employee1.id;
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;

  const balance = async () => {
    const response = await request(app.getHttpServer())
      .get(`/overtime/balance/${personId}`)
      .set(authHeader(adminCookie));
    expect(response.status).toBe(200);
    return response.body;
  };

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

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
    employeeCookie = (await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD))
      .cookieHeader;
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

  it('only an admin can correct a balance', async () => {
    const refused = await request(app.getHttpServer())
      .post('/overtime/corrections')
      .set(authHeader(employeeCookie))
      .send({ personId, balanceMinutes: 0 });
    expect(refused.status).toBe(403);
  });

  it('replaces last month and the days before today, and counts today on top', async () => {
    // Two hours over last month, never approved.
    await logDay(firstWorkingDayLastMonth(), 660);
    const pastDay = pastWorkingDayThisMonth();
    if (pastDay) {
      await logDay(pastDay, 660);
    }

    const before = await balance();
    expect(before.remainingMinutes).toBe(pastDay ? 240 : 120);
    expect(before.correction).toBeNull();

    const created = await request(app.getHttpServer())
      .post('/overtime/corrections')
      .set(authHeader(adminCookie))
      .send({ personId, balanceMinutes: -90, note: 'Plătit în avans' });
    expect(created.status).toBe(201);
    expect(created.body.previousBalanceMinutes).toBe(before.remainingMinutes);
    expect(created.body.note).toBe('Plătit în avans');

    const after = await balance();
    expect(after.remainingMinutes).toBe(-90);
    expect(after.carriedInMinutes).toBe(-90);
    expect(after.correction.balanceMinutes).toBe(-90);

    // Work logged today still counts: 10h today is +1h on top of the correction.
    await logDay(todayWorkDate(), 600);
    expect((await balance()).remainingMinutes).toBe(-30);

    // Last month's unapproved hours were replaced, so there is nothing to pay.
    const preview = await request(app.getHttpServer())
      .get(`/overtime/settlement-preview?month=${lastMonthKey()}`)
      .set(authHeader(adminCookie));
    expect(preview.status).toBe(200);
    expect(
      preview.body.lines.find((line: { person: { id: string } }) => line.person.id === personId),
    ).toBeUndefined();
  });

  it('undoing a correction brings the computed balance back', async () => {
    await logDay(firstWorkingDayLastMonth(), 660);

    const created = await request(app.getHttpServer())
      .post('/overtime/corrections')
      .set(authHeader(adminCookie))
      .send({ personId, balanceMinutes: 0 });
    expect((await balance()).remainingMinutes).toBe(0);

    const deleted = await request(app.getHttpServer())
      .delete(`/overtime/corrections/${created.body.id}`)
      .set(authHeader(adminCookie));
    expect(deleted.status).toBe(204);

    const restored = await balance();
    expect(restored.remainingMinutes).toBe(120);
    expect(restored.correction).toBeNull();
  });

  it('refuses a balance outside the allowed range', async () => {
    const refused = await request(app.getHttpServer())
      .post('/overtime/corrections')
      .set(authHeader(adminCookie))
      .send({ personId, balanceMinutes: 10_000_000 });
    expect(refused.status).toBe(400);
  });
});
