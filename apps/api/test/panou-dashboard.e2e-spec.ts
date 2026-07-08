import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function localTodayIsoTime(hours: number, minutes: number): string {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

describe('Panou dashboard metrics and summaries (e2e)', () => {
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

  it('GET /timesheets/dashboard-metrics is forbidden for EMPLOYEE', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(employee1Cookie));

    expect(response.status).toBe(403);
  });

  it('GET /timesheets/person-summary is forbidden for EMPLOYEE', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'today' })
      .set(authHeader(employee1Cookie));

    expect(response.status).toBe(403);
  });

  it('returns today dashboard metrics and period summaries with DB aggregation', async () => {
    const baseline = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(adminCookie))
      .expect(200);

    const baselineMinutes = baseline.body.todayTotalMinutes as number;
    const baselinePersonCount = baseline.body.todayDistinctPersonCount as number;
    const baselineInProgress = baseline.body.inProgressProjectCount as number;

    expect(baselineInProgress).toBe(2);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        startTime: localTodayIsoTime(8, 0),
        endTime: localTodayIsoTime(10, 0),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.second.id,
        startTime: localTodayIsoTime(11, 0),
        endTime: localTodayIsoTime(12, 30),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        startTime: localTodayIsoTime(9, 0),
        endTime: localTodayIsoTime(10, 0),
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
        startTime: localTodayIsoTime(14, 0),
        endTime: localTodayIsoTime(15, 0),
      })
      .expect(201);

    const metrics = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(adminCookie))
      .expect(200);

    expect(metrics.body.inProgressProjectCount).toBe(baselineInProgress - 1);
    expect(metrics.body.todayTotalMinutes).toBe(baselineMinutes + 330);
    expect(metrics.body.todayDistinctPersonCount).toBe(
      Math.max(baselinePersonCount, 2),
    );

    const projectSummary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(projectSummary.body.period).toBe('today');
    expect(projectSummary.body.projects).toHaveLength(2);

    const readyProject = projectSummary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.ready.id,
    );
    const finalizedProject = projectSummary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.notReady.id,
    );

    expect(readyProject.totalMinutes).toBe(270);
    expect(finalizedProject.totalMinutes).toBe(60);

    const projectActivities = readyProject.activities as Array<{
      activityId: string | null;
      minutes: number;
    }>;

    expect(projectActivities).toHaveLength(2);
    expect(projectActivities[0].minutes).toBe(180);
    expect(projectActivities[0].activityId).toBe(FIXTURES.activities.active.id);
    expect(projectActivities[1].minutes).toBe(90);
    expect(projectActivities[1].activityId).toBe(FIXTURES.activities.second.id);

    const personSummary = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(personSummary.body.period).toBe('today');
    expect(personSummary.body.persons).toHaveLength(2);

    const employee1Row = personSummary.body.persons.find(
      (person: { id: string }) => person.id === FIXTURES.persons.employee1.id,
    );
    const employee2Row = personSummary.body.persons.find(
      (person: { id: string }) => person.id === FIXTURES.persons.employee2.id,
    );

    expect(employee1Row.totalMinutes).toBe(270);
    expect(employee1Row.activities).toHaveLength(2);
    expect(employee1Row.activities[0].minutes).toBe(180);
    expect(employee1Row.activities[0].activityId).toBe(FIXTURES.activities.active.id);
    expect(employee1Row.activities[1].minutes).toBe(90);
    expect(employee2Row.totalMinutes).toBe(60);
    expect(employee2Row.activities).toHaveLength(1);
  });

  it('rejects invalid period on person-summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'invalid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
