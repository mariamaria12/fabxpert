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

describe('Project availability stream (e2e)', () => {
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

  it('GET /projects/available/stream is accessible to EMPLOYEE', (done) => {
    const req = request(app.getHttpServer())
      .get('/projects/available/stream')
      .set(authHeader(employee1Cookie))
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

  it('emits on readyForExecution false→true update', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ readyForExecution: false })
      .expect(200);

    const listener = listenForAvailabilityChanged(app, employee1Cookie);
    await sleep(300);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ readyForExecution: true })
      .expect(200);

    await expect(listener.promise).resolves.toBe('changed');

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ readyForExecution: false })
      .expect(200);
  });

  it('does NOT emit on name-only update of a not-ready project', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ readyForExecution: false })
      .expect(200);

    const listener = listenForAvailabilityChanged(app, employee1Cookie, 3000);
    await sleep(300);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ name: 'E2E Not Ready Project Renamed' })
      .expect(200);

    const result = await listener.promise;
    listener.close();

    expect(result).toBe('timeout');

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.notReady.id}`)
      .set(authHeader(adminCookie))
      .send({ name: 'E2E Not Ready Project' })
      .expect(200);
  });
});
