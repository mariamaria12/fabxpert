import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

/**
 * The two figures typed in on the project form — parts per ton (complexity)
 * and linear meters of weld. Both stay empty until someone fills them in, so
 * every operation has to work with and without a value.
 */
describe('Project piecesPerTon and weldLengthMeters (e2e)', () => {
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

  it('creates with both values and reads them back', async () => {
    const created = await createProject({
      name: 'E2E Complexity With Values',
      code: `E2E-CX-VALUE-${Date.now()}`,
      piecesPerTon: 142.5,
      weldLengthMeters: 850,
    }).expect(201);

    expect(created.body.piecesPerTon).toBe(142.5);
    expect(created.body.weldLengthMeters).toBe(850);

    const fetched = await getProject(created.body.id).expect(200);
    expect(fetched.body.piecesPerTon).toBe(142.5);
    expect(fetched.body.weldLengthMeters).toBe(850);
  });

  it('creates without them and reads back null', async () => {
    const created = await createProject({
      name: 'E2E Complexity Omitted',
      code: `E2E-CX-OMITTED-${Date.now()}`,
    }).expect(201);

    expect(created.body.piecesPerTon).toBeNull();
    expect(created.body.weldLengthMeters).toBeNull();
  });

  it('sets, preserves and clears the values across updates', async () => {
    const created = await createProject({
      name: 'E2E Complexity Update',
      code: `E2E-CX-UPDATE-${Date.now()}`,
    }).expect(201);
    const id = created.body.id;

    const set = await patchProject(id, { piecesPerTon: 320, weldLengthMeters: 1250.5 }).expect(200);
    expect(set.body.piecesPerTon).toBe(320);
    expect(set.body.weldLengthMeters).toBe(1250.5);

    // An update that leaves the fields out must not wipe them.
    const untouched = await patchProject(id, { name: 'E2E Complexity Renamed' }).expect(200);
    expect(untouched.body.piecesPerTon).toBe(320);
    expect(untouched.body.weldLengthMeters).toBe(1250.5);

    const cleared = await patchProject(id, { piecesPerTon: null, weldLengthMeters: null }).expect(200);
    expect(cleared.body.piecesPerTon).toBeNull();
    expect(cleared.body.weldLengthMeters).toBeNull();
  });

  it('rejects negative and non-numeric values', async () => {
    await createProject({
      name: 'E2E Complexity Negative',
      code: `E2E-CX-NEGATIVE-${Date.now()}`,
      piecesPerTon: -1,
    }).expect(400);

    await createProject({
      name: 'E2E Weld Length Text',
      code: `E2E-CX-TEXT-${Date.now()}`,
      weldLengthMeters: '850',
    }).expect(400);

    const created = await createProject({
      name: 'E2E Complexity Reject Update',
      code: `E2E-CX-REJECT-${Date.now()}`,
      piecesPerTon: 60,
      weldLengthMeters: 40,
    }).expect(201);

    await patchProject(created.body.id, { weldLengthMeters: -5 }).expect(400);

    const fetched = await getProject(created.body.id).expect(200);
    expect(fetched.body.piecesPerTon).toBe(60);
    expect(fetched.body.weldLengthMeters).toBe(40);
  });

  it('sorts the list by either figure with the empty ones last', async () => {
    const token = `CXSORT${Date.now()}`;

    for (const [suffix, piecesPerTon, weldLengthMeters] of [
      ['LOW', 30, 900],
      ['NONE', null, null],
      ['HIGH', 480, 120],
    ] as const) {
      await createProject({
        name: `E2E ${token} ${suffix}`,
        code: `E2E-${token}-${suffix}`,
        piecesPerTon,
        weldLengthMeters,
      }).expect(201);
    }

    const byComplexity = await request(app.getHttpServer())
      .get('/projects')
      .query({ search: token, sortBy: 'piecesPerTon', sortOrder: 'desc', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);
    expect(byComplexity.body.data.map((row: { piecesPerTon: number | null }) => row.piecesPerTon))
      .toEqual([480, 30, null]);

    const byWeld = await request(app.getHttpServer())
      .get('/projects')
      .query({ search: token, sortBy: 'weldLengthMeters', sortOrder: 'asc', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);
    expect(byWeld.body.data.map((row: { weldLengthMeters: number | null }) => row.weldLengthMeters))
      .toEqual([120, 900, null]);
  });

  it('hands parts per ton to the pinned cards on the panou', async () => {
    await patchProject(FIXTURES.projects.ready.id, { isPinned: true, piecesPerTon: 210 }).expect(200);

    const summary = await request(app.getHttpServer())
      .get('/timesheets/pinned-summary')
      .set(authHeader(adminCookie))
      .expect(200);

    const card = summary.body.projects.find(
      (row: { id: string }) => row.id === FIXTURES.projects.ready.id,
    );
    expect(card?.piecesPerTon).toBe(210);
  });
});
