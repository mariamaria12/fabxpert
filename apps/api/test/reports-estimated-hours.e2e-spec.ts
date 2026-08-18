import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

/**
 * Rapoarte reads the estimate straight off the project's `estimatedHours`,
 * so a project without one has no estimate at all — start and deadline dates
 * no longer produce one.
 */
describe('Reports estimate from estimatedHours (e2e)', () => {
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

  async function createFinalizedProject(body: Record<string, unknown>): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({ companyId: FIXTURES.companies.c1.id, ...body })
      .expect(201);

    // Completion is stamped on the transition, which puts the project in the
    // current-month interval the report below asks for.
    await request(app.getHttpServer())
      .patch(`/projects/${created.body.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'FINALIZAT' })
      .expect(200);

    return created.body.id;
  }

  it('reports the project estimate in minutes, and none when the field is empty', async () => {
    const stamp = Date.now();
    const withEstimate = `E2E-REPORT-EH-${stamp}`;
    const withoutEstimate = `E2E-REPORT-NOEH-${stamp}`;

    await createFinalizedProject({
      name: 'E2E Report With Estimate',
      code: withEstimate,
      estimatedHours: 40,
    });

    // Dates used to drive the old business-days estimate; they must not now.
    await createFinalizedProject({
      name: 'E2E Report Without Estimate',
      code: withoutEstimate,
      startDate: '2026-08-03',
      dueDate: '2026-08-14',
    });

    const report = await request(app.getHttpServer())
      .get('/reports/productivity')
      .query({ period: 'currentMonth' })
      .set(authHeader(adminCookie))
      .expect(200);

    const rows: { code: string; estimatedMinutes: number | null }[] = report.body.projectHours;

    expect(rows.find((row) => row.code === withEstimate)?.estimatedMinutes).toBe(2400);
    expect(rows.find((row) => row.code === withoutEstimate)?.estimatedMinutes).toBeNull();
    expect(report.body.kpis.totalEstimatedMinutes).toBe(2400);
  });
});
