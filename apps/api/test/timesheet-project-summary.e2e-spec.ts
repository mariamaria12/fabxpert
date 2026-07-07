import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Timesheet project summary (e2e)', () => {
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

  it('GET /timesheets/project-summary is forbidden for EMPLOYEE', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .set(authHeader(employee1Cookie));

    expect(response.status).toBe(403);
  });

  it('aggregates closed timesheets for in-progress projects only', async () => {
    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        startTime: '2026-07-01T08:00:00.000Z',
        endTime: '2026-07-01T10:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.second.id,
        startTime: '2026-07-01T11:00:00.000Z',
        endTime: '2026-07-01T12:30:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({ projectId: FIXTURES.projects.ready.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'FINALIZAT' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.notReady.id,
        activityId: FIXTURES.activities.active.id,
        startTime: '2026-07-02T08:00:00.000Z',
        endTime: '2026-07-02T09:00:00.000Z',
      })
      .expect(201);

    const summary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'all' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(summary.body.period).toBe('all');
    expect(summary.body.projects).toHaveLength(1);
    expect(summary.body.projects[0].id).toBe(FIXTURES.projects.ready.id);
    expect(summary.body.projects[0].totalMinutes).toBe(210);

    const activities = summary.body.projects[0].activities as Array<{
      activityId: string | null;
      minutes: number;
    }>;

    expect(activities).toHaveLength(2);
    expect(activities[0].minutes).toBe(120);
    expect(activities[0].activityId).toBe(FIXTURES.activities.active.id);
    expect(activities[1].minutes).toBe(90);
    expect(activities[1].activityId).toBe(FIXTURES.activities.second.id);
  });

  it('rejects invalid period', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'invalid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
