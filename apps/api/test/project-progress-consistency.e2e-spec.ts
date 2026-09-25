import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

/**
 * A project has one progress figure. The project, the pinned card and the
 * hours view all hand over the same one — none of them works out its own.
 */
describe('Project progress consistency (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  const projectId = FIXTURES.projects.ready.id;
  const trackedActivityId = FIXTURES.activities.active.id;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
    const server = app.getHttpServer();

    await request(server)
      .patch(`/activities/${trackedActivityId}`)
      .set(authHeader(adminCookie))
      .send({ tracksAssemblies: true })
      .expect(200);

    // 10 × 100 kg + 5 × 200 kg. By tonnes alone five light pieces are a quarter
    // of the list; the formula also counts each piece, so it says more.
    const light = await request(server)
      .post(`/projects/${projectId}/assemblies`)
      .set(authHeader(adminCookie))
      .send({ name: 'E2E-PRG-1', quantity: 10, weightPerPiece: 100 })
      .expect(201);
    await request(server)
      .post(`/projects/${projectId}/assemblies`)
      .set(authHeader(adminCookie))
      .send({ name: 'E2E-PRG-2', quantity: 5, weightPerPiece: 200 })
      .expect(201);

    await request(server)
      .patch(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .send({ isPinned: true })
      .expect(200);

    await request(server)
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId,
        activityId: trackedActivityId,
        workDate: '2026-07-01',
        durationMinutes: 120,
        assemblies: [{ assemblyId: light.body.id, quantityDone: 5 }],
      })
      .expect(201);

    // A project with hours on an untracked step only, and no list.
    await request(server)
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.notReady.id,
        activityId: FIXTURES.activities.second.id,
        workDate: '2026-07-01',
        durationMinutes: 60,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('shows the same progress on the project, the pinned card and the hours view', async () => {
    const server = app.getHttpServer();

    const project = await request(server)
      .get(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .expect(200);
    const progress = project.body.progressPercent as number;
    expect(progress).toBeGreaterThan(25);

    const pinned = await request(server)
      .get('/timesheets/pinned-summary')
      .set(authHeader(adminCookie))
      .expect(200);
    const card = pinned.body.projects.find((row: { id: string }) => row.id === projectId);
    expect(card.progressPercent).toBe(progress);

    const hours = await request(server)
      .get('/timesheets/project-summary')
      .query({ period: 'all' })
      .set(authHeader(adminCookie))
      .expect(200);
    const byId = new Map(
      hours.body.projects.map((row: { id: string; progressPercent: number | null }) => [
        row.id,
        row.progressPercent,
      ]),
    );
    expect(byId.get(projectId)).toBe(progress);
    expect(byId.get(FIXTURES.projects.notReady.id)).toBeNull();
  });
});
