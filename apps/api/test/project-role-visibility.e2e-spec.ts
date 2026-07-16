import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function listenForAvailabilityChanged(
  app: INestApplication,
  cookie: string,
  timeoutMs = 8000,
): { promise: Promise<'changed' | 'timeout'>; close: () => void } {
  let settled = false;
  let req: request.Test | null = null;
  let resRef: NodeJS.ReadableStream | null = null;
  let timeoutRef: NodeJS.Timeout | null = null;

  const closeConnection = () => {
    resRef?.destroy();
    req?.abort();
  };

  const promise = new Promise<'changed' | 'timeout'>((resolve) => {
    timeoutRef = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      closeConnection();
      resolve('timeout');
    }, timeoutMs);

    req = request(app.getHttpServer())
      .get('/projects/available/stream')
      .set(authHeader(cookie))
      .buffer(false)
      .parse((res, callback) => {
        resRef = res;
        res.on('data', (chunk: Buffer) => {
          if (settled) {
            return;
          }
          if (chunk.toString().includes('available-projects-changed')) {
            settled = true;
            if (timeoutRef) {
              clearTimeout(timeoutRef);
            }
            closeConnection();
            resolve('changed');
          }
        });
        callback(null, '');
      });

    req.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }
      if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
        return;
      }
      settled = true;
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      closeConnection();
      resolve('timeout');
    });

    req.end();
  });

  return {
    promise,
    close: () => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      closeConnection();
    },
  };
}

describe('Project role visibility (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employee1Cookie: string;
  let employee2Cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
    employee1Cookie = (
      await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)
    ).cookieHeader;
    employee2Cookie = (
      await login(app, FIXTURES.users.employee2.email, E2E_PASSWORD)
    ).cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns unrestricted ready projects for all employees', async () => {
    const employee1 = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee1Cookie))
      .expect(200);

    const employee2 = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);

    expect(
      employee1.body.some((project: { id: string }) => project.id === FIXTURES.projects.ready.id),
    ).toBe(true);
    expect(
      employee2.body.some((project: { id: string }) => project.id === FIXTURES.projects.ready.id),
    ).toBe(true);
  });

  it('returns role-restricted project only for matching employee role', async () => {
    const employee1 = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee1Cookie))
      .expect(200);

    const employee2 = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);

    expect(
      employee1.body.some(
        (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
      ),
    ).toBe(true);
    expect(
      employee2.body.some(
        (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
      ),
    ).toBe(false);
  });

  it('does not return role-restricted project for employee with a different role', async () => {
    await request(app.getHttpServer())
      .patch(`/persons/${FIXTURES.persons.employee2.id}`)
      .set(authHeader(adminCookie))
      .send({ employeeRoleId: FIXTURES.employeeRole2.id })
      .expect(200);

    const employee2 = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);

    expect(
      employee2.body.some(
        (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
      ),
    ).toBe(false);
  });

  it('updates visibility when project visibleForRoleIds change', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .send({ visibleForRoleIds: [] })
      .expect(200);

    const employee2AfterClear = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);

    expect(
      employee2AfterClear.body.some(
        (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .send({ visibleForRoleIds: [FIXTURES.employeeRole.id] })
      .expect(200);

    const employee2AfterRestrict = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);

    expect(
      employee2AfterRestrict.body.some(
        (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
      ),
    ).toBe(false);
  });

  it('includes visibleForRoles on admin GET /projects/:id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .expect(200);

    expect(response.body.visibleForRoles).toEqual([
      { id: FIXTURES.employeeRole.id, name: FIXTURES.employeeRole.name },
    ]);
  });

  it('includes visibleForRoles on admin GET /projects list', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects?page=1&pageSize=50')
      .set(authHeader(adminCookie))
      .expect(200);

    const restricted = response.body.data.find(
      (project: { id: string }) => project.id === FIXTURES.projects.roleRestricted.id,
    );

    expect(restricted).toBeDefined();
    expect(restricted.visibleForRoles).toEqual([
      { id: FIXTURES.employeeRole.id, name: FIXTURES.employeeRole.name },
    ]);
  });

  it('rejects invalid visibleForRoleIds on create/update', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ visibleForRoleIds: ['e2e00001-0000-0000-0000-000000000999'] })
      .expect(400);
  });

  it('emits availability SSE when visibleForRoles change on a ready project', async () => {
    const listener = listenForAvailabilityChanged(app, employee1Cookie);
    await sleep(300);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .send({ visibleForRoleIds: [FIXTURES.employeeRole2.id] })
      .expect(200);

    await expect(listener.promise).resolves.toBe('changed');

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .send({ visibleForRoleIds: [FIXTURES.employeeRole.id] })
      .expect(200);
  });
});
