import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

/**
 * A project can switch off an activity that tracks assemblies, e.g. painting
 * on a galvanised one: workers log it with hours only and it leaves the
 * progress, so the other steps alone can finish the project.
 */
describe('Project untracked activities (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;
  const projectId = FIXTURES.projects.ready.id;
  const weldingId = FIXTURES.activities.active.id;
  const paintingId = FIXTURES.activities.second.id;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
    employeeCookie = (await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)).cookieHeader;
    const server = app.getHttpServer();

    for (const activityId of [weldingId, paintingId]) {
      await request(server)
        .patch(`/activities/${activityId}`)
        .set(authHeader(adminCookie))
        .send({ tracksAssemblies: true })
        .expect(200);
    }

    const assembly = await request(server)
      .post(`/projects/${projectId}/assemblies`)
      .set(authHeader(adminCookie))
      .send({ name: 'E2E-UNT-1', quantity: 4, weightPerPiece: 100 })
      .expect(201);

    // The whole list welded; nothing painted.
    await request(server)
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId,
        activityId: weldingId,
        workDate: '2026-07-01',
        durationMinutes: 240,
        assemblies: [{ assemblyId: assembly.body.id, quantityDone: 4 }],
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('tracks every flagged activity by default', async () => {
    const project = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .expect(200);

    expect(project.body.untrackedActivityIds).toEqual([]);
    expect(project.body.progressPercent).toBeLessThan(100);
  });

  it('finishes the project without the step it switched off', async () => {
    const server = app.getHttpServer();

    const updated = await request(server)
      .patch(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .send({ untrackedActivityIds: [paintingId] })
      .expect(200);
    expect(updated.body.untrackedActivityIds).toEqual([paintingId]);
    expect(updated.body.progressPercent).toBe(100);

    const project = await request(server)
      .get(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .expect(200);
    expect(project.body.progressPercent).toBe(100);
  });

  it('tells the mobile app which activities skip the assembly step', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employeeCookie))
      .expect(200);

    const project = response.body.find((row: { id: string }) => row.id === projectId);
    expect(project.untrackedActivityIds).toEqual([paintingId]);
  });

  it('logs hours on the switched-off step without a progress row', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId,
        activityId: paintingId,
        workDate: '2026-07-02',
        durationMinutes: 60,
      })
      .expect(201);

    const hours = await request(server)
      .get('/timesheets/project-summary')
      .query({ period: 'all' })
      .set(authHeader(adminCookie))
      .expect(200);
    const row = hours.body.projects.find((entry: { id: string }) => entry.id === projectId);
    const byActivity = new Map(
      row.activities.map((activity: { activityId: string; assemblyProgress: unknown }) => [
        activity.activityId,
        activity.assemblyProgress,
      ]),
    );
    expect(byActivity.get(weldingId)).not.toBeNull();
    expect(byActivity.get(paintingId)).toBeNull();
  });

  it('counts the step again once it is ticked back', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .send({ untrackedActivityIds: [] })
      .expect(200);

    expect(updated.body.untrackedActivityIds).toEqual([]);
    expect(updated.body.progressPercent).toBeLessThan(100);
  });

  it('refuses an activity that does not track assemblies', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .send({ untrackedActivityIds: [FIXTURES.activities.inactive.id] })
      .expect(400);
  });

  it('drops a stored activity that stopped tracking assemblies instead of refusing the save', async () => {
    const server = app.getHttpServer();

    await request(server)
      .patch(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .send({ untrackedActivityIds: [paintingId] })
      .expect(200);
    await request(server)
      .patch(`/activities/${paintingId}`)
      .set(authHeader(adminCookie))
      .send({ tracksAssemblies: false })
      .expect(200);

    // The form cannot show painting any more, but still holds its id.
    const updated = await request(server)
      .patch(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .send({ untrackedActivityIds: [paintingId] })
      .expect(200);
    expect(updated.body.untrackedActivityIds).toEqual([]);
  });
});
