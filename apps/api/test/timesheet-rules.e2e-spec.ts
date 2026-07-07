import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES, NON_EXISTENT_UUID } from './helpers/fixtures';

describe('Timesheet rules (e2e)', () => {
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

  async function stopIfOpen(cookie: string) {
    await request(app.getHttpServer())
      .post('/timesheets/stop')
      .set(authHeader(cookie))
      .send({});
  }

  it('EMPLOYEE start resolves personId and userId from auth; personId in body → 400', async () => {
    await stopIfOpen(employee1Cookie);

    const start = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({ projectId: FIXTURES.projects.ready.id });

    expect(start.status).toBe(201);
    expect(start.body.personId).toBe(FIXTURES.persons.employee1.id);
    expect(start.body.userId).toBe(FIXTURES.users.employee1.id);

    const withPersonId = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        personId: FIXTURES.persons.employee1.id,
      });

    expect(withPersonId.status).toBe(400);
    expect(withPersonId.body.message).toBe('personId must not be supplied by employees');

    await stopIfOpen(employee1Cookie);
  });

  it('single-open rule: second start → 409; after stop, start succeeds', async () => {
    await stopIfOpen(employee1Cookie);

    await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({ projectId: FIXTURES.projects.ready.id })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({ projectId: FIXTURES.projects.ready.id });

    expect(second.status).toBe(409);
    expect(second.body.message).toBe('This person already has an open timesheet');

    await request(app.getHttpServer())
      .post('/timesheets/stop')
      .set(authHeader(employee1Cookie))
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({ projectId: FIXTURES.projects.ready.id })
      .expect(201);

    await stopIfOpen(employee1Cookie);
  });

  it('stop with no open timesheet → 404', async () => {
    await stopIfOpen(employee1Cookie);

    const response = await request(app.getHttpServer())
      .post('/timesheets/stop')
      .set(authHeader(employee1Cookie))
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No open timesheet to stop');
  });

  it('inactive activity → 400; active activity → 201', async () => {
    await stopIfOpen(employee1Cookie);

    const inactive = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.inactive.id,
      });

    expect(inactive.status).toBe(400);
    expect(inactive.body.message).toBe(
      'activityId does not reference an existing active activity',
    );

    const active = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
      });

    expect(active.status).toBe(201);
    await stopIfOpen(employee1Cookie);
  });

  it('EMPLOYEE on not-ready project → 400; ADMIN manual create on same project → 201', async () => {
    await stopIfOpen(employee1Cookie);

    const employeeStart = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({ projectId: FIXTURES.projects.notReady.id });

    expect(employeeStart.status).toBe(400);
    expect(employeeStart.body.message).toBe(
      'This project is not available for employee time logging',
    );

    const adminCreate = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.notReady.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(adminCreate.status).toBe(201);
  });

  it('ADMIN manual create without personId → 400; non-existent personId → 400', async () => {
    const missingPerson = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(missingPerson.status).toBe(400);
    expect(missingPerson.body.message).toBe(
      'personId is required when creating a timesheet on behalf of someone',
    );

    const badPerson = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: NON_EXISTENT_UUID,
        projectId: FIXTURES.projects.ready.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(badPerson.status).toBe(400);
    expect(badPerson.body.message).toBe('personId does not reference an existing person');
  });

  it('manual create with endTime <= startTime → 400', async () => {
    const startTime = new Date('2026-01-01T10:00:00.000Z');
    const endTime = new Date('2026-01-01T09:00:00.000Z');

    const response = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('endTime must be after startTime');
  });

  it('ownership: EMPLOYEE PATCH other → 403; own → 200; EMPLOYEE DELETE other → 403; own → 204; ADMIN DELETE → 204 + soft delete', async () => {
    const create = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        startTime: new Date('2026-02-01T08:00:00.000Z').toISOString(),
        endTime: new Date('2026-02-01T12:00:00.000Z').toISOString(),
        notes: 'employee2 entry',
      });

    expect(create.status).toBe(201);
    const timesheetId = create.body.id;

    const patchOther = await request(app.getHttpServer())
      .patch(`/timesheets/${timesheetId}`)
      .set(authHeader(employee1Cookie))
      .send({ notes: 'hacked' });

    expect(patchOther.status).toBe(403);

    const patchOwn = await request(app.getHttpServer())
      .patch(`/timesheets/${timesheetId}`)
      .set(authHeader(employee2Cookie))
      .send({ notes: 'updated by owner' });

    expect(patchOwn.status).toBe(200);

    const employeeDeleteOther = await request(app.getHttpServer())
      .delete(`/timesheets/${timesheetId}`)
      .set(authHeader(employee1Cookie));

    expect(employeeDeleteOther.status).toBe(403);

    const employeeDeleteOwn = await request(app.getHttpServer())
      .delete(`/timesheets/${timesheetId}`)
      .set(authHeader(employee2Cookie));

    expect(employeeDeleteOwn.status).toBe(204);

    const row = await getTestPrisma().timesheet.findUnique({
      where: { id: timesheetId },
      select: { deletedAt: true },
    });
    expect(row?.deletedAt).not.toBeNull();

    const createForAdmin = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        startTime: new Date('2026-02-02T08:00:00.000Z').toISOString(),
        endTime: new Date('2026-02-02T12:00:00.000Z').toISOString(),
        notes: 'admin delete target',
      });

    expect(createForAdmin.status).toBe(201);

    const adminDelete = await request(app.getHttpServer())
      .delete(`/timesheets/${createForAdmin.body.id}`)
      .set(authHeader(adminCookie));

    expect(adminDelete.status).toBe(204);

    const adminDeletedRow = await getTestPrisma().timesheet.findUnique({
      where: { id: createForAdmin.body.id },
      select: { deletedAt: true },
    });
    expect(adminDeletedRow?.deletedAt).not.toBeNull();
  });

  it('GET /timesheets/mine returns nested person/project/activity', async () => {
    await stopIfOpen(employee1Cookie);

    await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
      })
      .expect(201);

    const mine = await request(app.getHttpServer())
      .get('/timesheets/mine')
      .set(authHeader(employee1Cookie));

    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBeGreaterThan(0);

    const entry = mine.body.data[0];
    expect(entry.person).toMatchObject({
      id: FIXTURES.persons.employee1.id,
      firstName: 'E2E',
      lastName: 'EmployeeOne',
    });
    expect(entry.project).toMatchObject({
      id: FIXTURES.projects.ready.id,
      code: FIXTURES.projects.ready.code,
    });
    expect(entry.activity).toMatchObject({
      id: FIXTURES.activities.active.id,
      name: FIXTURES.activities.active.name,
    });

    await stopIfOpen(employee1Cookie);
  });

  it('EMPLOYEE whose linked person was soft-deleted cannot start timesheet', async () => {
    const prisma = getTestPrisma();
    const personId = 'e2e00001-0000-0000-0000-000000000050';
    const userId = 'e2e00001-0000-0000-0000-000000000150';
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 12);

    await prisma.person.create({
      data: {
        id: personId,
        firstName: 'E2E',
        lastName: 'DeletedPerson',
        deletedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        id: userId,
        email: 'deleted-person@e2e.test',
        passwordHash,
        role: 'EMPLOYEE',
        personId,
      },
    });

    const { cookieHeader } = await login(app, 'deleted-person@e2e.test', E2E_PASSWORD);

    const start = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(cookieHeader))
      .send({ projectId: FIXTURES.projects.ready.id });

    expect(start.status).toBe(400);
    expect(start.body.message).toBe('Your user account is not linked to a person');
  });
});
