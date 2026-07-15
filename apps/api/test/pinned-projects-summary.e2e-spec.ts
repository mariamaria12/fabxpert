import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function localWorkDateOnly(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function listenForAvailabilityChanged(
  app: INestApplication,
  cookie: string,
  timeoutMs = 4000,
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

  return { promise, close: closeConnection };
}

describe('Pinned projects summary (e2e)', () => {
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

  it('returns pinned projects including zero-hour projects with activity breakdown', async () => {
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

    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        workDate: localWorkDateOnly(0),
        durationMinutes: 120,
      })
      .expect(201);

    const summary = await request(app.getHttpServer())
      .get('/timesheets/pinned-summary')
      .set(authHeader(adminCookie))
      .expect(200);

    expect(summary.body.projects.length).toBeGreaterThanOrEqual(2);

    const pinnedReady = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.ready.id,
    );
    expect(pinnedReady).toBeDefined();
    expect(pinnedReady.totalMinutes).toBeGreaterThanOrEqual(120);
    expect(pinnedReady.activities.length).toBeGreaterThan(0);
    expect(
      pinnedReady.activities.some(
        (activity: { activityId: string; minutes: number }) =>
          activity.activityId === FIXTURES.activities.active.id && activity.minutes >= 120,
      ),
    ).toBe(true);

    const pinnedNotReady = summary.body.projects.find(
      (project: { id: string }) => project.id === FIXTURES.projects.notReady.id,
    );
    expect(pinnedNotReady).toBeDefined();
    expect(pinnedNotReady.totalMinutes).toBe(0);
    expect(pinnedNotReady.activities).toHaveLength(0);

    const names = summary.body.projects.map((project: { name: string }) => project.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('does not emit availability SSE when toggling isPinned only', async () => {
    const listener = listenForAvailabilityChanged(app, adminCookie);
    await sleep(300);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ isPinned: false })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.ready.id}`)
      .set(authHeader(adminCookie))
      .send({ isPinned: true })
      .expect(200);

    const result = await listener.promise;
    listener.close();
    expect(result).toBe('timeout');
  });
});
