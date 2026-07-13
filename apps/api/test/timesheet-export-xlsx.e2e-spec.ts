import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function localWorkDateOnly(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('Timesheet Excel export (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employee1Cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
    employee1Cookie = (
      await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)
    ).cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /timesheets/export.xlsx is forbidden for EMPLOYEE', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/export.xlsx')
      .query({ period: 'month' })
      .set(authHeader(employee1Cookie));

    expect(response.status).toBe(403);
  });

  it('returns an xlsx download for ADMIN with non-empty body', async () => {
    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        workDate: localWorkDateOnly(0),
        durationMinutes: 90,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/timesheets/export.xlsx')
      .query({ period: 'month' })
      .set(authHeader(adminCookie))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.headers['content-disposition']).toMatch(/attachment; filename="pontaje_/);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).length).toBeGreaterThan(100);
    expect((response.body as Buffer).subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('returns a valid workbook with headers when the period has no rows', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/export.xlsx')
      .query({ period: 'custom', from: '1999-01-01', to: '1999-01-02' })
      .set(authHeader(adminCookie))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect((response.body as Buffer).length).toBeGreaterThan(100);
  });
});
