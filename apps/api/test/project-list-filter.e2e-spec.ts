import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Project list statusGroup filter (e2e)', () => {
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

  it('filters in_progress vs completed and excludes ANULAT from both', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'FINALIZAT' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'ANULAT' })
      .expect(200);

    const inProgress = await request(app.getHttpServer())
      .get('/projects')
      .query({ statusGroup: 'in_progress', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(inProgress.body.meta.total).toBe(0);
    expect(inProgress.body.data).toHaveLength(0);

    const completed = await request(app.getHttpServer())
      .get('/projects')
      .query({ statusGroup: 'completed', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(completed.body.meta.total).toBe(1);
    expect(completed.body.data[0].id).toBe(FIXTURES.projects.ready.id);
    expect(completed.body.data[0].status).toBe('FINALIZAT');

    const all = await request(app.getHttpServer())
      .get('/projects')
      .query({ pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(all.body.meta.total).toBe(2);
  });

  it('rejects invalid statusGroup', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .query({ statusGroup: 'invalid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
