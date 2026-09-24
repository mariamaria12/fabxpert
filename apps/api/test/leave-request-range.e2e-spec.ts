import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { FIXTURES, E2E_PASSWORD } from './helpers/fixtures';

describe('Leave requests by date range (e2e)', () => {
  const personId = FIXTURES.persons.employee1.id;
  let app: INestApplication;
  let adminCookie: string;

  const listIds = async (query: string) => {
    const response = await request(app.getHttpServer())
      .get(`/leave-requests?${query}`)
      .set(authHeader(adminCookie));
    expect(response.status).toBe(200);
    return (response.body.data as { id: string }[]).map((row) => row.id);
  };

  let march: string;
  let acrossMonths: string;
  let may: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;

    const prisma = getTestPrisma();
    await prisma.leaveRequest.deleteMany({ where: { personId } });
    const create = (start: Date, end: Date) =>
      prisma.leaveRequest.create({
        data: { personId, type: 'ODIHNA', startDate: start, endDate: end, status: 'APROBAT' },
      });

    march = (await create(new Date(2031, 2, 10), new Date(2031, 2, 14))).id;
    acrossMonths = (await create(new Date(2031, 2, 31), new Date(2031, 3, 2))).id;
    may = (await create(new Date(2031, 4, 5), new Date(2031, 4, 6))).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns only requests overlapping the range, those crossing its edge included', async () => {
    const april = await listIds(`personId=${personId}&from=2031-04-01&to=2031-04-30`);
    expect(april).toEqual([acrossMonths]);

    const marchIds = await listIds(`personId=${personId}&from=2031-03-01&to=2031-03-31`);
    expect(marchIds.sort()).toEqual([march, acrossMonths].sort());

    expect(await listIds(`personId=${personId}&from=2031-05-06&to=2031-05-06`)).toEqual([may]);
  });

  it('ignores the range when it is missing', async () => {
    expect((await listIds(`personId=${personId}`)).length).toBe(3);
  });
});
