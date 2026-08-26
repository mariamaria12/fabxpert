import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';
import {
  TimesheetEventsService,
  type TimesheetEventPayload,
} from '../src/timesheet/timesheet-events.service';

/**
 * The live banner tells admins that an employee touched a timesheet. An admin
 * editing one must stay silent — otherwise it reads as if the employee had
 * changed it.
 */
describe('Admin timesheet edit emits no update event (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;
  let received: TimesheetEventPayload[];
  let unsubscribe: () => void;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
    employeeCookie = (
      await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)
    ).cookieHeader;

    received = [];
    const subscription = app
      .get(TimesheetEventsService)
      .subscribe()
      .subscribe((message) => {
        received.push(message.data as TimesheetEventPayload);
      });
    unsubscribe = () => subscription.unsubscribe();
  });

  afterAll(async () => {
    unsubscribe();
    await app.close();
  });

  async function createEntry(): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        durationMinutes: 60,
      })
      .expect(201);

    return created.body.id;
  }

  it('stays silent when an admin edits, and still fires when the employee does', async () => {
    const id = await createEntry();

    received.length = 0;
    await request(app.getHttpServer())
      .patch(`/timesheets/${id}`)
      .set(authHeader(adminCookie))
      .send({ durationMinutes: 120 })
      .expect(200);

    expect(received.filter((event) => event.type === 'updated')).toEqual([]);

    received.length = 0;
    await request(app.getHttpServer())
      .patch(`/timesheets/${id}`)
      .set(authHeader(employeeCookie))
      .send({ durationMinutes: 180 })
      .expect(200);

    expect(received.filter((event) => event.type === 'updated')).toHaveLength(1);
  });
});
