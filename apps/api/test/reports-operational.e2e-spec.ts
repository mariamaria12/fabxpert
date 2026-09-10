import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES, NON_EXISTENT_UUID } from './helpers/fixtures';

/**
 * The three reports that read one project at a time: its fișa, how its hours
 * compare with the pieces actually finished, and what a delivered project
 * leaves behind as an hours-per-ton norm. All three run raw SQL over the same
 * assembly progress the pontaj summary uses, so they are worth exercising
 * against a real database rather than a mocked Prisma.
 */
describe('Operational reports (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;

  const projectId = FIXTURES.projects.ready.id;
  const trackedActivityId = FIXTURES.activities.active.id;
  const otherActivityId = FIXTURES.activities.second.id;

  let firstAssemblyId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
    employeeCookie = (
      await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)
    ).cookieHeader;

    const server = app.getHttpServer();

    // One activity tracks assemblies, the other does not — the reports must
    // tell the two apart.
    await request(server)
      .patch(`/activities/${trackedActivityId}`)
      .set(authHeader(adminCookie))
      .send({ tracksAssemblies: true })
      .expect(200);

    // 10 × 100 kg + 5 × 200 kg = 2000 kg, which the project's weight follows.
    const firstAssembly = await request(server)
      .post(`/projects/${projectId}/assemblies`)
      .set(authHeader(adminCookie))
      .send({ name: 'E2E-ASM-1', quantity: 10, weightPerPiece: 100 })
      .expect(201);
    firstAssemblyId = firstAssembly.body.id;

    await request(server)
      .post(`/projects/${projectId}/assemblies`)
      .set(authHeader(adminCookie))
      .send({ name: 'E2E-ASM-2', quantity: 5, weightPerPiece: 200 })
      .expect(201);

    await request(server)
      .patch(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .send({ estimatedHours: 4 })
      .expect(200);

    // 2 h of the tracked step, covering 5 of the 15 pieces (500 of 2000 kg).
    await request(server)
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId,
        activityId: trackedActivityId,
        workDate: '2026-07-01',
        durationMinutes: 120,
        assemblies: [{ assemblyId: firstAssemblyId, quantityDone: 5 }],
      })
      .expect(201);

    // 1 h of a step that carries no pieces at all.
    await request(server)
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId,
        activityId: otherActivityId,
        workDate: '2026-07-02',
        durationMinutes: 60,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /reports/projects/:projectId', () => {
    it('is forbidden for EMPLOYEE', async () => {
      await request(app.getHttpServer())
        .get(`/reports/projects/${projectId}`)
        .set(authHeader(employeeCookie))
        .expect(403);
    });

    it('404s for a project that does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/reports/projects/${NON_EXISTENT_UUID}`)
        .set(authHeader(adminCookie))
        .expect(404);
    });

    it('crosses the project by activity and by person, with the list progress', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reports/projects/${projectId}`)
        .set(authHeader(adminCookie))
        .expect(200);

      const { project, totals, byActivity, byPerson } = response.body;

      expect(project.code).toBe(FIXTURES.projects.ready.code);
      expect(project.weightKg).toBe(2000);

      expect(totals.workedMinutes).toBe(180);
      expect(totals.estimatedMinutes).toBe(240);
      // 240 estimated over 180 worked — under budget.
      expect(totals.efficiencyPct).toBe(133);
      // 3 h over 2 t.
      expect(totals.hoursPerTon).toBe(1.5);
      expect(totals.peopleCount).toBe(2);
      expect(totals.firstWorkDay).toBe('2026-07-01');
      expect(totals.lastWorkDay).toBe('2026-07-02');

      const tracked = byActivity.find(
        (row: { activityId: string | null }) => row.activityId === trackedActivityId,
      );
      expect(tracked.workedMinutes).toBe(120);
      expect(tracked.progress).toMatchObject({
        piecesDone: 5,
        piecesTotal: 15,
        weightDoneKg: 500,
        weightTotalKg: 2000,
        piecesManual: 0,
      });

      const untracked = byActivity.find(
        (row: { activityId: string | null }) => row.activityId === otherActivityId,
      );
      expect(untracked.workedMinutes).toBe(60);
      expect(untracked.progress).toBeNull();

      expect(byPerson).toHaveLength(2);
      expect(byPerson[0].workedMinutes).toBe(120);
      expect(byPerson[0].byActivity).toEqual([
        { activityId: trackedActivityId, minutes: 120 },
      ]);
      expect(byPerson[1].workedMinutes).toBe(60);
    });
  });

  describe('GET /reports/active-projects', () => {
    it('is forbidden for EMPLOYEE', async () => {
      await request(app.getHttpServer())
        .get('/reports/active-projects')
        .set(authHeader(employeeCookie))
        .expect(403);
    });

    it('reads hours against the pieces actually finished', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set(authHeader(adminCookie))
        .send({ status: 'IN_PRODUCTIE' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/reports/active-projects')
        .set(authHeader(adminCookie))
        .expect(200);

      const row = response.body.rows.find(
        (candidate: { id: string }) => candidate.id === projectId,
      );

      expect(row.workedMinutes).toBe(180);
      expect(row.estimatedMinutes).toBe(240);
      // 180 of the 240 estimated minutes are gone…
      expect(row.hoursPct).toBe(75);
      // …while only 500 of the 2000 kg have been through the tracked step.
      expect(row.physicalPct).toBe(25);
      expect(row.gapPct).toBe(50);

      // Only the tracked step is in play; the other activity carries no pieces.
      expect(row.steps).toHaveLength(1);
      expect(row.steps[0].activityId).toBe(trackedActivityId);
      expect(row.steps[0].progressPct).toBe(25);
      expect(row.steps[0].workedMinutes).toBe(120);
    });
  });

  describe('GET /reports/norms', () => {
    it('is forbidden for EMPLOYEE', async () => {
      await request(app.getHttpServer())
        .get('/reports/norms')
        .set(authHeader(employeeCookie))
        .expect(403);
    });

    it('rejects a window outside the allowed range', async () => {
      await request(app.getHttpServer())
        .get('/reports/norms')
        .query({ months: '99' })
        .set(authHeader(adminCookie))
        .expect(400);
    });

    it('turns a delivered project into hours per ton, per activity', async () => {
      // Delivery stamps completedAt, which puts the project in the window.
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set(authHeader(adminCookie))
        .send({ status: 'FINALIZAT' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/reports/norms')
        .query({ months: '12' })
        .set(authHeader(adminCookie))
        .expect(200);

      const { body } = response;

      expect(body.months).toBe(12);
      expect(body.projectCount).toBe(1);
      expect(body.totalTons).toBe(2);
      expect(body.totalWorkedMinutes).toBe(180);
      // 3 h over 2 t.
      expect(body.pooledHoursPerTon).toBe(1.5);

      const tracked = body.activities.find(
        (row: { activityId: string | null }) => row.activityId === trackedActivityId,
      );
      // 2 h over 2 t.
      expect(tracked.pooledHoursPerTon).toBe(1);
      expect(tracked.medianHoursPerTon).toBe(1);
      expect(tracked.projectCount).toBe(1);

      const other = body.activities.find(
        (row: { activityId: string | null }) => row.activityId === otherActivityId,
      );
      // 1 h over 2 t.
      expect(other.pooledHoursPerTon).toBe(0.5);
    });
  });
});
