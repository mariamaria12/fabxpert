import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES, NON_EXISTENT_UUID } from './helpers/fixtures';

function workDateIso(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

  it('start/stop endpoints are removed → 404', async () => {
    const start = await request(app.getHttpServer())
      .post('/timesheets/start')
      .set(authHeader(employee1Cookie))
      .send({ projectId: FIXTURES.projects.ready.id });

    expect(start.status).toBe(404);

    const stop = await request(app.getHttpServer())
      .post('/timesheets/stop')
      .set(authHeader(employee1Cookie))
      .send({});

    expect(stop.status).toBe(404);
  });

  it('EMPLOYEE create resolves personId and userId from auth; personId in body → 400', async () => {
    const create = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        durationMinutes: 60,
      });

    expect(create.status).toBe(201);
    expect(create.body.personId).toBe(FIXTURES.persons.employee1.id);
    expect(create.body.userId).toBe(FIXTURES.users.employee1.id);
    expect(create.body.durationMinutes).toBe(60);

    const withPersonId = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        durationMinutes: 30,
        personId: FIXTURES.persons.employee1.id,
      });

    expect(withPersonId.status).toBe(400);
    expect(withPersonId.body.message).toBe('personId must not be supplied by employees');
  });

  it('inactive activity → 400; active activity → 201', async () => {
    const inactive = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.inactive.id,
        durationMinutes: 45,
      });

    expect(inactive.status).toBe(400);
    expect(inactive.body.message).toBe(
      'activityId does not reference an existing active activity',
    );

    const active = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        durationMinutes: 45,
      });

    expect(active.status).toBe(201);
  });

  it('EMPLOYEE on not-ready project → 400; ADMIN create on same project → 201', async () => {
    const employeeCreate = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.notReady.id,
        durationMinutes: 60,
      });

    expect(employeeCreate.status).toBe(400);
    expect(employeeCreate.body.message).toBe(
      'This project is not available for employee time logging',
    );

    const adminCreate = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee1.id,
        projectId: FIXTURES.projects.notReady.id,
        durationMinutes: 60,
      });

    expect(adminCreate.status).toBe(201);
  });

  it('ADMIN create without personId → 400; non-existent personId → 400', async () => {
    const missingPerson = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        durationMinutes: 60,
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
        durationMinutes: 60,
      });

    expect(badPerson.status).toBe(400);
    expect(badPerson.body.message).toBe('personId does not reference an existing person');
  });

  it('create with non-positive durationMinutes → 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        durationMinutes: 0,
      });

    expect(response.status).toBe(400);
  });

  it('ownership: EMPLOYEE PATCH other → 403; own → 200; EMPLOYEE DELETE other → 403; own → 204; ADMIN DELETE → 204 + soft delete', async () => {
    const create = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(adminCookie))
      .send({
        personId: FIXTURES.persons.employee2.id,
        projectId: FIXTURES.projects.ready.id,
        workDate: '2026-02-01',
        durationMinutes: 240,
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
      .send({ durationMinutes: 300, notes: 'updated by owner' });

    expect(patchOwn.status).toBe(200);
    expect(patchOwn.body.durationMinutes).toBe(300);

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
        workDate: '2026-02-02',
        durationMinutes: 120,
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

  it('GET /timesheets/mine returns nested person/project/activity with workDate + durationMinutes', async () => {
    await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(employee1Cookie))
      .send({
        projectId: FIXTURES.projects.ready.id,
        activityId: FIXTURES.activities.active.id,
        durationMinutes: 90,
        workDate: workDateIso(0),
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
    expect(entry.durationMinutes).toBe(90);
    expect(entry.workDate).toBeDefined();
  });

  it('EMPLOYEE whose linked person was soft-deleted cannot create timesheet', async () => {
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

    const create = await request(app.getHttpServer())
      .post('/timesheets')
      .set(authHeader(cookieHeader))
      .send({
        projectId: FIXTURES.projects.ready.id,
        durationMinutes: 30,
      });

    expect(create.status).toBe(400);
    expect(create.body.message).toBe('Your user account is not linked to a person');
  });
});
