import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

/**
 * CRUD over the `estimatedHours` project column — every operation has to work
 * both with a value and without one, since the field stays empty until an admin
 * fills it in.
 */
describe('Project estimatedHours CRUD (e2e)', () => {
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

  function createProject(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({ companyId: FIXTURES.companies.c1.id, ...body });
  }

  function getProject(id: string) {
    return request(app.getHttpServer())
      .get(`/projects/${id}`)
      .set(authHeader(adminCookie));
  }

  function patchProject(id: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .patch(`/projects/${id}`)
      .set(authHeader(adminCookie))
      .send(body);
  }

  it('creates with a value and reads it back', async () => {
    const created = await createProject({
      name: 'E2E Estimated Hours With Value',
      code: `E2E-EH-VALUE-${Date.now()}`,
      estimatedHours: 120.5,
    }).expect(201);

    expect(created.body.estimatedHours).toBe(120.5);

    const fetched = await getProject(created.body.id).expect(200);
    expect(fetched.body.estimatedHours).toBe(120.5);
  });

  it('creates without the field and reads back null', async () => {
    const created = await createProject({
      name: 'E2E Estimated Hours Omitted',
      code: `E2E-EH-OMITTED-${Date.now()}`,
    }).expect(201);

    expect(created.body.estimatedHours).toBeNull();

    const fetched = await getProject(created.body.id).expect(200);
    expect(fetched.body.estimatedHours).toBeNull();
  });

  it('creates with an explicit null', async () => {
    const created = await createProject({
      name: 'E2E Estimated Hours Explicit Null',
      code: `E2E-EH-NULL-${Date.now()}`,
      estimatedHours: null,
    }).expect(201);

    expect(created.body.estimatedHours).toBeNull();
  });

  it('sets, preserves and clears the value across updates', async () => {
    const created = await createProject({
      name: 'E2E Estimated Hours Update',
      code: `E2E-EH-UPDATE-${Date.now()}`,
    }).expect(201);
    const id = created.body.id;

    const set = await patchProject(id, { estimatedHours: 40 }).expect(200);
    expect(set.body.estimatedHours).toBe(40);

    // An update that leaves the field out must not wipe it.
    const untouched = await patchProject(id, { name: 'E2E Estimated Hours Renamed' }).expect(200);
    expect(untouched.body.name).toBe('E2E Estimated Hours Renamed');
    expect(untouched.body.estimatedHours).toBe(40);

    const cleared = await patchProject(id, { estimatedHours: null }).expect(200);
    expect(cleared.body.estimatedHours).toBeNull();

    const fetched = await getProject(id).expect(200);
    expect(fetched.body.estimatedHours).toBeNull();
  });

  it('rejects a negative value and a non-numeric one', async () => {
    await createProject({
      name: 'E2E Estimated Hours Negative',
      code: `E2E-EH-NEGATIVE-${Date.now()}`,
      estimatedHours: -1,
    }).expect(400);

    await createProject({
      name: 'E2E Estimated Hours Text',
      code: `E2E-EH-TEXT-${Date.now()}`,
      estimatedHours: '40',
    }).expect(400);

    const created = await createProject({
      name: 'E2E Estimated Hours Reject Update',
      code: `E2E-EH-REJECT-${Date.now()}`,
      estimatedHours: 8,
    }).expect(201);

    await patchProject(created.body.id, { estimatedHours: -5 }).expect(400);

    const fetched = await getProject(created.body.id).expect(200);
    expect(fetched.body.estimatedHours).toBe(8);
  });

  it('sorts the list by estimatedHours with the empty ones last', async () => {
    const token = `EHSORT${Date.now()}`;

    for (const [suffix, estimatedHours] of [
      ['LOW', 10],
      ['NONE', null],
      ['HIGH', 250],
    ] as const) {
      await createProject({
        name: `E2E ${token} ${suffix}`,
        code: `E2E-${token}-${suffix}`,
        estimatedHours,
      }).expect(201);
    }

    const listed = await request(app.getHttpServer())
      .get('/projects')
      .query({ search: token, sortBy: 'estimatedHours', sortOrder: 'asc', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(listed.body.data.map((row: { estimatedHours: number | null }) => row.estimatedHours))
      .toEqual([10, 250, null]);
  });

  it('deletes a project that has a value', async () => {
    const created = await createProject({
      name: 'E2E Estimated Hours Delete',
      code: `E2E-EH-DELETE-${Date.now()}`,
      estimatedHours: 16,
    }).expect(201);

    await request(app.getHttpServer())
      .delete(`/projects/${created.body.id}`)
      .set(authHeader(adminCookie))
      .expect(204);

    await getProject(created.body.id).expect(404);
  });
});
