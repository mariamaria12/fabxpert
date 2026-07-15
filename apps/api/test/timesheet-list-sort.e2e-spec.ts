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

function personDisplayName(row: { person: { firstName: string; lastName: string } }): string {
  return `${row.person.firstName} ${row.person.lastName}`;
}

describe('Timesheet list sort (e2e)', () => {
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

  it('sorts by date, person, project, and activity', async () => {
    const today = localWorkDateOnly(0);
    const yesterday = localWorkDateOnly(-1);

    await request(app.getHttpServer())
      .patch(`/persons/${FIXTURES.persons.employee1.id}`)
      .set(authHeader(adminCookie))
      .send({ firstName: 'Ana', lastName: 'Popescu' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/persons/${FIXTURES.persons.employee2.id}`)
      .set(authHeader(adminCookie))
      .send({ firstName: 'Bogdan', lastName: 'Ionescu' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        workDate: today,
        durationMinutes: 60,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.second.id,
        workDate: yesterday,
        durationMinutes: 90,
      })
      .expect(201);

    const byDateDesc = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'month', sortBy: 'date', sortOrder: 'desc', pageSize: '50' })
      .set(authHeader(adminCookie))
      .expect(200);

    const datesDesc = byDateDesc.body.data.map((row: { workDate: string }) => row.workDate);
    expect(datesDesc.length).toBeGreaterThan(1);
    expect([...datesDesc].sort((a, b) => b.localeCompare(a))).toEqual(datesDesc);

    const byDateAsc = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'month', sortBy: 'date', sortOrder: 'asc', pageSize: '50' })
      .set(authHeader(adminCookie))
      .expect(200);

    const datesAsc = byDateAsc.body.data.map((row: { workDate: string }) => row.workDate);
    expect([...datesAsc].sort((a, b) => a.localeCompare(b))).toEqual(datesAsc);
    expect(datesAsc[0]).not.toBe(datesDesc[0]);

    const byPersonAsc = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'month', sortBy: 'person', sortOrder: 'asc', pageSize: '50' })
      .set(authHeader(adminCookie))
      .expect(200);

    const personNames = byPersonAsc.body.data.map(personDisplayName);
    expect([...personNames].sort((a, b) => a.localeCompare(b))).toEqual(personNames);
    expect(personNames[0]).toBe('Ana Popescu');

    const byPersonDesc = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'month', sortBy: 'person', sortOrder: 'desc', pageSize: '50' })
      .set(authHeader(adminCookie))
      .expect(200);

    const personNamesDesc = byPersonDesc.body.data.map(personDisplayName);
    expect([...personNamesDesc].sort((a, b) => b.localeCompare(a))).toEqual(personNamesDesc);
    expect(personNamesDesc[0]).toBe('Bogdan Ionescu');

    const byProjectAsc = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'month', sortBy: 'project', sortOrder: 'asc', pageSize: '50' })
      .set(authHeader(adminCookie))
      .expect(200);

    const projectNames = byProjectAsc.body.data.map(
      (row: { project: { name: string } }) => row.project.name,
    );
    expect([...projectNames].sort((a, b) => a.localeCompare(b))).toEqual(projectNames);

    const byActivityAsc = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'month', sortBy: 'activity', sortOrder: 'asc', pageSize: '50' })
      .set(authHeader(adminCookie))
      .expect(200);

    const activityNames = byActivityAsc.body.data.map(
      (row: { activity: { name: string } | null }) => row.activity?.name ?? '',
    );
    expect([...activityNames].sort((a, b) => a.localeCompare(b))).toEqual(activityNames);
  });

  it('rejects invalid sortBy', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ sortBy: 'durationMinutes' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
