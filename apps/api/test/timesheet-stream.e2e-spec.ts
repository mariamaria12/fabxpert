import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Timesheet stream (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /timesheets/stream is forbidden for EMPLOYEE', async () => {
    const forbidden = await request(app.getHttpServer())
      .get('/timesheets/stream')
      .set(authHeader(employee1Cookie));

    expect(forbidden.status).toBe(403);
  });

  it('GET /timesheets/stream returns text/event-stream for ADMIN', (done) => {
    const req = request(app.getHttpServer())
      .get('/timesheets/stream')
      .set(authHeader(adminCookie))
      .buffer(false)
      .parse((res, callback) => {
        callback(null, '');
      });

    req.on('response', (res) => {
      try {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
        res.destroy();
        req.abort();
        done();
      } catch (error) {
        res.destroy();
        req.abort();
        done(error);
      }
    });

    req.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
        done();
        return;
      }
      done(error);
    });

    req.end();
  });
});

describe('Timesheet createdAt filter (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('listTimesheets supports createdAtFrom/createdAtTo', async () => {
    const create = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        durationMinutes: 45,
      });

    expect(create.status).toBe(201);
    const createdAt = create.body.createdAt as string;
    const from = new Date(new Date(createdAt).getTime() - 60_000).toISOString();
    const to = new Date(new Date(createdAt).getTime() + 60_000).toISOString();

    const filtered = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ createdAtFrom: from, createdAtTo: to, pageSize: '10' })
      .set(authHeader(adminCookie));

    expect(filtered.status).toBe(200);
    expect(filtered.body.data.some((row: { id: string }) => row.id === create.body.id)).toBe(
      true,
    );

    const before = new Date(new Date(createdAt).getTime() - 120_000).toISOString();
    const middle = new Date(new Date(createdAt).getTime() - 60_000).toISOString();

    const empty = await request(app.getHttpServer())
      .get('/timesheets')
      .query({ createdAtFrom: before, createdAtTo: middle, pageSize: '10' })
      .set(authHeader(adminCookie));

    expect(empty.status).toBe(200);
    expect(
      empty.body.data.some((row: { id: string }) => row.id === create.body.id),
    ).toBe(false);
  });
});
