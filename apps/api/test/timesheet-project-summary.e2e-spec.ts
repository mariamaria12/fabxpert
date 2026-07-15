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

  it('aggregates timesheets by project for the selected period using durationMinutes', async () => {
    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        workDate: '2026-07-01',
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
        workDate: '2026-07-01',
        durationMinutes: 90,
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
        workDate: '2026-07-02',
        durationMinutes: 60,
      })
      .expect(201);

    const summary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'all' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(summary.body.period).toBe('all');
    expect(summary.body.projects).toHaveLength(2);

    const readyProject = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.ready.id,
    );
    const finalizedProject = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.notReady.id,
    );

    expect(readyProject.totalMinutes).toBe(210);
    expect(readyProject.status).toBe('CIORNA');
    expect(finalizedProject.totalMinutes).toBe(60);
    expect(finalizedProject.status).toBe('FINALIZAT');

    const activities = readyProject.activities as Array<{
      activityId: string | null;
      minutes: number;
    }>;

    expect(activities).toHaveLength(2);
    expect(activities[0].minutes).toBe(120);
    expect(activities[0].activityId).toBe(FIXTURES.activities.active.id);
    expect(activities[1].minutes).toBe(90);
    expect(activities[1].activityId).toBe(FIXTURES.activities.second.id);
  });

  it('includes timesheets on terminal-status projects when the project is not deleted', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'LIVRAT' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'ANULAT' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.roleRestricted.id,
        activityId: FIXTURES.activities.active.id,
        workDate: '2026-07-03',
        durationMinutes: 45,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.notReady.id,
        activityId: FIXTURES.activities.active.id,
        workDate: '2026-07-03',
        durationMinutes: 30,
      })
      .expect(201);

    const summary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'all' })
      .set(authHeader(adminCookie))
      .expect(200);

    const deliveredProject = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
    );
    const cancelledProject = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.notReady.id,
    );

    expect(deliveredProject).toMatchObject({
      id: FIXTURES.projects.roleRestricted.id,
      status: 'LIVRAT',
      totalMinutes: 45,
    });
    expect(cancelledProject).toMatchObject({
      id: FIXTURES.projects.notReady.id,
      status: 'ANULAT',
      totalMinutes: 90,
    });
  });

  it('rejects invalid period', async () => {
    const response = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'invalid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
