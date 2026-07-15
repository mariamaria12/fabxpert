import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function localTodayWorkDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sumProjectSummaryMinutes(projects: Array<{ totalMinutes: number }>): number {
  return projects.reduce((sum, project) => sum + project.totalMinutes, 0);
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
        workDate: localTodayWorkDate(),
        durationMinutes: 120,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.second.id,
        workDate: localTodayWorkDate(),
        durationMinutes: 90,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        workDate: localTodayWorkDate(),
        durationMinutes: 60,
      })
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
        workDate: localTodayWorkDate(),
        durationMinutes: 60,
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

    expect(metrics.body.todayTotalMinutes).toBe(
      sumProjectSummaryMinutes(projectSummary.body.projects),
    );

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
    expect(metrics.body.todayDistinctPersonCount).toBe(
      personSummary.body.persons.length,
    );

    const employee1Row = personSummary.body.persons.find(
      (person: { id: string }) => person.id === FIXTURES.persons.employee1.id,
    );
    const employee2Row = personSummary.body.persons.find(
      (person: { id: string }) => person.id === FIXTURES.persons.employee2.id,
    );

    expect(employee1Row.totalMinutes).toBe(270);
    expect(employee1Row.activities).toHaveLength(3);
    expect(employee1Row.activities[0].minutes).toBe(120);
    expect(employee1Row.activities[0].projectId).toBe(FIXTURES.projects.ready.id);
    expect(employee1Row.activities[0].activityId).toBe(FIXTURES.activities.active.id);
    expect(employee1Row.activities[1].minutes).toBe(90);
    expect(employee1Row.activities[1].activityId).toBe(FIXTURES.activities.second.id);
    expect(employee1Row.activities[2].minutes).toBe(60);
    expect(employee1Row.activities[2].projectId).toBe(FIXTURES.projects.notReady.id);
    expect(employee2Row.totalMinutes).toBe(60);
    expect(employee2Row.activities).toHaveLength(1);
    expect(employee2Row.activities[0].projectId).toBe(FIXTURES.projects.ready.id);
  });

  it('dashboard metrics include todayOnLeaveCount for approved leave covering today', async () => {
    const today = localTodayWorkDate();

    const create = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: today,
        endDate: today,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/leave-requests/${create.body.leaveRequest.id}/review`)
      .set(authHeader(adminCookie))
      .send({ status: 'APROBAT' })
      .expect(200);

    const metrics = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(adminCookie))
      .expect(200);

    expect(metrics.body.todayOnLeaveCount).toBeGreaterThanOrEqual(1);

    const onLeaveToday = await request(app.getHttpServer())
      .get('/leave-requests/on-leave')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    const matchingRow = onLeaveToday.body.requests.find(
      (row: { id: string }) => row.id === create.body.leaveRequest.id,
    );
    expect(matchingRow).toMatchObject({
      person: {
        id: FIXTURES.persons.employee1.id,
      },
      type: 'ODIHNA',
      startDate: today,
      endDate: today,
      dayCount: 1,
    });
  });

  it('dashboard todayDistinctPersonCount matches person-summary after soft-deleting a project', async () => {
    const today = localTodayWorkDate();

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.notReady.id,
        activityId: FIXTURES.activities.active.id,
        workDate: today,
        durationMinutes: 30,
      })
      .expect(201);

    const beforeMetrics = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(adminCookie))
      .expect(200);
    const beforeSummary = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);
    const beforeProjectSummary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(beforeMetrics.body.todayDistinctPersonCount).toBe(
      beforeSummary.body.persons.length,
    );
    expect(beforeMetrics.body.todayTotalMinutes).toBe(
      sumProjectSummaryMinutes(beforeProjectSummary.body.projects),
    );

    await request(app.getHttpServer())
      .delete(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .expect(204);

    const metrics = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(adminCookie))
      .expect(200);
    const personSummary = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);
    const projectSummary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(metrics.body.todayDistinctPersonCount).toBe(
      personSummary.body.persons.length,
    );
    expect(metrics.body.todayTotalMinutes).toBe(
      sumProjectSummaryMinutes(projectSummary.body.projects),
    );
    expect(metrics.body.todayTotalMinutes).toBeLessThan(
      beforeMetrics.body.todayTotalMinutes,
    );
  });

  it('includes timesheets on terminal-status projects in today project and person summaries', async () => {
    const today = localTodayWorkDate();

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'LIVRAT' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.roleRestricted.id,
        activityId: FIXTURES.activities.active.id,
        workDate: today,
        durationMinutes: 45,
      })
      .expect(201);

    const projectSummary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    const deliveredProject = projectSummary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
    );
    expect(deliveredProject).toMatchObject({
      id: FIXTURES.projects.roleRestricted.id,
      status: 'LIVRAT',
      totalMinutes: 45,
    });

    const personSummary = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    const employee1Row = personSummary.body.persons.find(
      (person: { id: string }) => person.id === FIXTURES.persons.employee1.id,
    );
    expect(
      employee1Row.activities.some(
        (activity: { projectId: string; projectStatus: string; minutes: number }) =>
          activity.projectId === FIXTURES.projects.roleRestricted.id &&
          activity.projectStatus === 'LIVRAT' &&
          activity.minutes === 45,
      ),
    ).toBe(true);
  });

  it('rejects invalid period on person-summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'invalid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
