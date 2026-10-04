import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function workDate(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('Timesheet day groups (e2e)', () => {
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

  function createEntry(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({ projectId: FIXTURES.projects.ready.id, ...body })
      .expect(201);
  }

  function listGroups(query: Record<string, string> = {}) {
    return request(app.getHttpServer())
      .get('/timesheets/grouped')
      .query({ period: 'month', pageSize: '20', ...query })
      .set(authHeader(adminCookie))
      .expect(200);
  }

  it('returns one row per person per day, with totals and activity breakdown', async () => {
    const today = workDate(0);

    // Two entries the same day for one person, one for another person.
    await createEntry({
      personId: FIXTURES.persons.employee1.id,
      activityId: FIXTURES.activities.active.id,
      workDate: today,
      durationMinutes: 180,
    });
    await createEntry({
      personId: FIXTURES.persons.employee1.id,
      activityId: FIXTURES.activities.second.id,
      workDate: today,
      durationMinutes: 120,
    });
    await createEntry({
      personId: FIXTURES.persons.employee2.id,
      activityId: FIXTURES.activities.active.id,
      workDate: today,
      durationMinutes: 60,
    });

    const response = await listGroups();

    // Three entries, but two people on one day -> two rows.
    expect(response.body.meta.total).toBe(2);
    expect(response.body.data).toHaveLength(2);

    const group = response.body.data.find(
      (row: { person: { id: string } }) => row.person.id === FIXTURES.persons.employee1.id,
    );

    expect(group.entryCount).toBe(2);
    expect(group.totalMinutes).toBe(300);
    expect(group.entries).toHaveLength(2);
    expect(group.id).toBe(`${FIXTURES.persons.employee1.id}:${today}`);
    expect(
      group.activityTotals.map((activity: { minutes: number }) => activity.minutes),
    ).toEqual([180, 120]);
  });

  it('splits the same person across days', async () => {
    await createEntry({
      personId: FIXTURES.persons.employee1.id,
      activityId: FIXTURES.activities.active.id,
      workDate: workDate(-1),
      durationMinutes: 60,
    });

    const response = await listGroups({ personId: FIXTURES.persons.employee1.id });

    expect(response.body.meta.total).toBe(2);
    expect(
      response.body.data.map((row: { totalMinutes: number }) => row.totalMinutes),
    ).toEqual([300, 60]);
  });

  it('keeps only the entries of the filtered activity', async () => {
    const response = await listGroups({ activityId: FIXTURES.activities.second.id });

    // Only employee1 logged the second activity, once, today.
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].person.id).toBe(FIXTURES.persons.employee1.id);
    expect(response.body.data[0].entries).toHaveLength(1);
    expect(response.body.data[0].totalMinutes).toBe(120);
  });

  it('returns one project as a pinned card row, over its whole history', async () => {
    const response = await request(app.getHttpServer())
      .get(`/timesheets/project-breakdown/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .expect(200);

    expect(response.body.id).toBe(FIXTURES.projects.ready.id);
    // Shaped like a pinned card's row, details included.
    expect(response.body.company.name).toEqual(expect.any(String));
    expect(response.body.visibleForRoles).toEqual(expect.any(Array));
    expect(response.body.totalMinutes).toBe(420);
    expect(
      response.body.activities.map((activity: { minutes: number }) => activity.minutes),
    ).toEqual([300, 120]);
  });

  it('paginates over days rather than entries', async () => {
    const firstPage = await listGroups({ pageSize: '1', page: '1' });

    expect(firstPage.body.data).toHaveLength(1);
    expect(firstPage.body.meta.total).toBe(3);
    expect(firstPage.body.meta.totalPages).toBe(3);
  });

  it('rejects an invalid sortBy', async () => {
    await request(app.getHttpServer())
      .get('/timesheets/grouped')
      .query({ sortBy: 'nope' })
      .set(authHeader(adminCookie))
      .expect(400);
  });

  it('is admin-only', async () => {
    const employeeCookie = (
      await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)
    ).cookieHeader;

    await request(app.getHttpServer())
      .get('/timesheets/grouped')
      .set(authHeader(employeeCookie))
      .expect(403);
  });
});
