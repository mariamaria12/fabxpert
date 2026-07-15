import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Pinned projects reorder (e2e)', () => {
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

  it('assigns indexPanou and panouColumn when pinning and persists custom order', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ isPinned: true })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ isPinned: true })
      .expect(200);

    const pinnedReady = await request(app.getHttpServer())
      .get(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .expect(200);

    const pinnedNotReady = await request(app.getHttpServer())
      .get(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .expect(200);

    expect(pinnedReady.body.indexPanou).not.toBeNull();
    expect(pinnedReady.body.panouColumn).not.toBeNull();
    expect(pinnedNotReady.body.indexPanou).not.toBeNull();
    expect(pinnedNotReady.body.panouColumn).not.toBeNull();

    await request(app.getHttpServer())
      .patch('/projects/pinned-order')
      .set(authHeader(adminCookie))
      .send({
        columns: [[FIXTURES.projects.notReady.id], [FIXTURES.projects.ready.id]],
      })
      .expect(204);

    const summary = await request(app.getHttpServer())
      .get('/timesheets/pinned-summary')
      .set(authHeader(adminCookie))
      .expect(200);

    const ready = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.ready.id,
    );
    const notReady = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.notReady.id,
    );

    expect(notReady.panouColumn).toBe(0);
    expect(notReady.indexPanou).toBe(0);
    expect(ready.panouColumn).toBe(1);
    expect(ready.indexPanou).toBe(0);
  });

  it('clears indexPanou and panouColumn when unpinning', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ isPinned: false })
      .expect(200);

    expect(response.body.isPinned).toBe(false);
    expect(response.body.indexPanou).toBeNull();
    expect(response.body.panouColumn).toBeNull();
  });

  it('rejects reorder with unknown or unpinned project ids', async () => {
    await request(app.getHttpServer())
      .patch('/projects/pinned-order')
      .set(authHeader(adminCookie))
      .send({ columns: [['00000000-0000-0000-0000-000000000099'], []] })
      .expect(400);
  });
});
