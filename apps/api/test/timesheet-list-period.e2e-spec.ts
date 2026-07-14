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

function localIsoDateOnly(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('Timesheet list period filter (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it('filters GET /timesheets by period=today and custom from/to at DB level', async () => {
    const today = localIsoDateOnly(0);
    const yesterday = localIsoDateOnly(-1);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        workDate: localWorkDateOnly(0),
        durationMinutes: 60,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        workDate: localWorkDateOnly(-1),
        durationMinutes: 60,
      })
      .expect(201);

    const todayList = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'today', pageSize: 50 })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(todayList.body.meta.total).toBe(1);
    expect(todayList.body.data).toHaveLength(1);
    expect(todayList.body.data[0].person.id).toBe(FIXTURES.persons.employee1.id);

    const customList = await request(app.getHttpServer())
      .get('/timesheets')
      .query({
        period: 'custom',
        from: yesterday,
        to: yesterday,
        pageSize: 50,
      })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(customList.body.meta.total).toBe(1);
    expect(customList.body.data).toHaveLength(1);
    expect(customList.body.data[0].person.id).toBe(FIXTURES.persons.employee2.id);

    expect(today).not.toBe(yesterday);
  });

  it('filters GET /timesheets by person name search at DB level', async () => {
    const list = await request(app.getHttpServer())
      .get('/timesheets')
      .query({
        period: 'month',
        search: 'EmployeeOne',
        pageSize: 50,
      })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(
      list.body.data.every(
        (row: { person: { id: string } }) => row.person.id === FIXTURES.persons.employee1.id,
      ),
    ).toBe(true);

    const noMatch = await request(app.getHttpServer())
      .get('/timesheets')
      .query({
        period: 'month',
        search: 'zzznomatchperson',
        pageSize: 50,
      })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(noMatch.body.meta.total).toBe(0);
    expect(noMatch.body.data).toHaveLength(0);
  });
});
