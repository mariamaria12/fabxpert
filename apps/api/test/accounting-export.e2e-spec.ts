import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

/** The month the pontaj tab opens on: the one before the current. */
function previousMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

describe('Accounting export and reopen (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;
  const month = previousMonth();

  const getReport = async () =>
    request(app.getHttpServer())
      .get('/overtime/accounting')
      .query({ month })
      .set(authHeader(adminCookie))
      .expect(200);

  const reopen = () =>
    request(app.getHttpServer())
      .delete('/overtime/accounting/export')
      .query({ month })
      .set(authHeader(adminCookie));

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
    employeeCookie = (await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)).cookieHeader;
    // The month starts open, whatever an earlier run left behind.
    await reopen().expect(200);
  });

  afterAll(async () => {
    await reopen();
    await app.close();
  });

  it('the export closes the month and the report says who closed it', async () => {
    const before = await getReport();
    expect(before.body.export).toBeNull();

    const exported = await request(app.getHttpServer())
      .post('/overtime/accounting/export')
      .query({ month })
      .set(authHeader(adminCookie))
      .expect(201);
    expect(exported.headers['content-disposition']).toContain('.xlsx');

    const after = await getReport();
    expect(after.body.export).not.toBeNull();
    expect(after.body.export.exportedAt).toEqual(expect.any(String));
  });

  it('reopening drops the marker, and the report reads open again', async () => {
    const response = await reopen().expect(200);
    expect(response.body).toEqual({ month, reopened: true });

    const after = await getReport();
    expect(after.body.export).toBeNull();
  });

  it('reopening an already open month answers reopened: false', async () => {
    const response = await reopen().expect(200);
    expect(response.body).toEqual({ month, reopened: false });
  });

  it('EMPLOYEE cannot reopen a month', async () => {
    await request(app.getHttpServer())
      .delete('/overtime/accounting/export')
      .query({ month })
      .set(authHeader(employeeCookie))
      .expect(403);
  });
});
