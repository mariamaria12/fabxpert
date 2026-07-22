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

    expect(inProgress.body.meta.total).toBe(1);
    expect(inProgress.body.data).toHaveLength(1);
    expect(inProgress.body.data[0].id).toBe(FIXTURES.projects.roleRestricted.id);

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

    expect(all.body.meta.total).toBe(3);
  });

  it('rejects invalid statusGroup', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .query({ statusGroup: 'invalid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });

  it('filters by exact status', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'IN_PRODUCTIE' })
      .expect(200);

    const filtered = await request(app.getHttpServer())
      .get('/projects')
      .query({ status: 'IN_PRODUCTIE', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(filtered.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      filtered.body.data.every((project: { status: string }) => project.status === 'IN_PRODUCTIE'),
    ).toBe(true);
  });

  it('filters by multiple statuses', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'CIORNA' })
      .expect(200);

    const filtered = await request(app.getHttpServer())
      .get('/projects')
      .query({ status: 'IN_PRODUCTIE,CIORNA', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(filtered.body.data.length).toBeGreaterThanOrEqual(2);
    expect(
      filtered.body.data.every(
        (project: { status: string }) =>
          project.status === 'IN_PRODUCTIE' || project.status === 'CIORNA',
      ),
    ).toBe(true);
  });

  it('rejects invalid status', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .query({ status: 'invalid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });

  it('sorts by name ascending by default and accepts sortBy/sortOrder', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'IN_PRODUCTIE' })
      .expect(200);

    const defaultList = await request(app.getHttpServer())
      .get('/projects')
      .query({ pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    const names = defaultList.body.data.map((row: { name: string }) => row.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);

    const byCodeDesc = await request(app.getHttpServer())
      .get('/projects')
      .query({ sortBy: 'code', sortOrder: 'desc', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    const codes = byCodeDesc.body.data.map((row: { code: string }) => row.code);
    expect([...codes].sort((a, b) => b.localeCompare(a))).toEqual(codes);
  });

  it('sorts in_progress projects when statusGroup and sortBy are combined', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'IN_PRODUCTIE' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'IN_PRODUCTIE' })
      .expect(200);

    const byNameAsc = await request(app.getHttpServer())
      .get('/projects')
      .query({
        statusGroup: 'in_progress',
        sortBy: 'name',
        sortOrder: 'asc',
        pageSize: '20',
      })
      .set(authHeader(adminCookie))
      .expect(200);

    const namesAsc = byNameAsc.body.data.map((row: { name: string }) => row.name);
    expect(namesAsc.length).toBeGreaterThan(1);
    expect([...namesAsc].sort((a, b) => a.localeCompare(b))).toEqual(namesAsc);

    const byNameDesc = await request(app.getHttpServer())
      .get('/projects')
      .query({
        statusGroup: 'in_progress',
        sortBy: 'name',
        sortOrder: 'desc',
        pageSize: '20',
      })
      .set(authHeader(adminCookie))
      .expect(200);

    const namesDesc = byNameDesc.body.data.map((row: { name: string }) => row.name);
    expect([...namesDesc].sort((a, b) => b.localeCompare(a))).toEqual(namesDesc);
    expect(namesDesc[0]).not.toBe(namesAsc[0]);
  });

  it('rejects invalid sortBy', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .query({ sortBy: 'passwordHash' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });

  it('filters by visibleFor everyone and role', async () => {
    const everyone = await request(app.getHttpServer())
      .get('/projects')
      .query({ visibleFor: 'everyone', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(
      everyone.body.data.every(
        (project: { visibleForRoles: unknown[] }) => project.visibleForRoles.length === 0,
      ),
    ).toBe(true);

    const byRole = await request(app.getHttpServer())
      .get('/projects')
      .query({ visibleFor: FIXTURES.employeeRole.id, pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(byRole.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      byRole.body.data.every((project: { visibleForRoles: { id: string }[] }) =>
        project.visibleForRoles.some((role) => role.id === FIXTURES.employeeRole.id),
      ),
    ).toBe(true);
  });

  it('rejects invalid visibleFor', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .query({ visibleFor: 'not-a-uuid' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
