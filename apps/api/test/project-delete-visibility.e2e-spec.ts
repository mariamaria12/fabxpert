import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

const TEST_PROJECT_ID = 'e2e00001-0000-0000-0000-000000000099';

function localWorkDateOnly(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sumProjectSummaryMinutes(projects: Array<{ totalMinutes: number }>): number {
  return projects.reduce((sum, project) => sum + project.totalMinutes, 0);
}

describe('Soft-deleted project visibility (e2e)', () => {
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

    await getTestPrisma().project.upsert({
      where: { id: TEST_PROJECT_ID },
      create: {
        id: TEST_PROJECT_ID,
        name: 'E2E Delete Visibility Project',
        code: 'E2E-DELVIS',
        companyId: FIXTURES.companies.c1.id,
        readyForExecution: true,
        isPinned: false,
        status: 'IN_PRODUCTIE',
      },
      update: {
        deletedAt: null,
        isPinned: false,
        readyForExecution: true,
        status: 'IN_PRODUCTIE',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('hides all related timesheet data after a project is removed', async () => {
    const workDate = localWorkDateOnly();

    await request(app.getHttpServer())
      .patch(`/projects/${TEST_PROJECT_ID}`)
      .set(authHeader(adminCookie))
      .send({ isPinned: true })
      .expect(200);

    const create = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: TEST_PROJECT_ID,
        activityId: FIXTURES.activities.active.id,
        workDate,
        durationMinutes: 75,
      })
      .expect(201);

    const beforeList = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'today', pageSize: 50 })
      .set(authHeader(adminCookie))
      .expect(200);
    const beforePinned = await request(app.getHttpServer())
      .get('/timesheets/pinned-summary')
      .set(authHeader(adminCookie))
      .expect(200);
    const beforeProjectSummary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);
    const beforePersonSummary = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);
    const beforeMetrics = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(adminCookie))
      .expect(200);
    const beforeMine = await request(app.getHttpServer())
      .get('/timesheets/mine')
      .query({ pageSize: 50 })
      .set(authHeader(employee1Cookie))
      .expect(200);

    expect(
      beforeList.body.data.some((row: { id: string }) => row.id === create.body.id),
    ).toBe(true);
    expect(
      beforePinned.body.projects.some(
        (project: { id: string }) => project.id === TEST_PROJECT_ID,
      ),
    ).toBe(true);
    expect(
      beforeProjectSummary.body.projects.some(
        (project: { id: string }) => project.id === TEST_PROJECT_ID,
      ),
    ).toBe(true);
    expect(beforeMetrics.body.todayTotalMinutes).toBe(
      sumProjectSummaryMinutes(beforeProjectSummary.body.projects),
    );
    expect(beforeMetrics.body.todayDistinctPersonCount).toBe(
      beforePersonSummary.body.persons.length,
    );
    expect(
      beforeMine.body.data.some((row: { id: string }) => row.id === create.body.id),
    ).toBe(true);

    await request(app.getHttpServer())
      .delete(`/projects/${TEST_PROJECT_ID}`)
      .set(authHeader(adminCookie))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/timesheets/${create.body.id}`)
      .set(authHeader(adminCookie))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/timesheets/${create.body.id}`)
      .set(authHeader(employee1Cookie))
      .expect(404);

    const afterList = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ period: 'today', pageSize: 50 })
      .set(authHeader(adminCookie))
      .expect(200);
    const afterPinned = await request(app.getHttpServer())
      .get('/timesheets/pinned-summary')
      .set(authHeader(adminCookie))
      .expect(200);
    const afterProjectSummary = await request(app.getHttpServer())
      .get('/timesheets/project-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);
    const afterPersonSummary = await request(app.getHttpServer())
      .get('/timesheets/person-summary')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);
    const afterMetrics = await request(app.getHttpServer())
      .get('/timesheets/dashboard-metrics')
      .set(authHeader(adminCookie))
      .expect(200);
    const afterMine = await request(app.getHttpServer())
      .get('/timesheets/mine')
      .query({ pageSize: 50 })
      .set(authHeader(employee1Cookie))
      .expect(200);
    const exportResponse = await request(app.getHttpServer())
      .get('/timesheets/export.xlsx')
      .query({ period: 'today' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(
      afterList.body.data.some((row: { id: string }) => row.id === create.body.id),
    ).toBe(false);
    expect(
      afterPinned.body.projects.some(
        (project: { id: string }) => project.id === TEST_PROJECT_ID,
      ),
    ).toBe(false);
    expect(
      afterProjectSummary.body.projects.some(
        (project: { id: string }) => project.id === TEST_PROJECT_ID,
      ),
    ).toBe(false);
    expect(
      afterPersonSummary.body.persons.some((person: { id: string; activities: Array<{ projectId: string }> }) =>
        person.activities.some(
          (activity) => activity.projectId === TEST_PROJECT_ID,
        ),
      ),
    ).toBe(false);
    expect(afterMetrics.body.todayTotalMinutes).toBe(
      sumProjectSummaryMinutes(afterProjectSummary.body.projects),
    );
    expect(afterMetrics.body.todayTotalMinutes).toBeLessThan(
      beforeMetrics.body.todayTotalMinutes,
    );
    expect(
      afterMine.body.data.some((row: { id: string }) => row.id === create.body.id),
    ).toBe(false);
    expect(exportResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
});
