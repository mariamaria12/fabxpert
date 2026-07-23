import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

type AvailableProject = { id: string; code: string; name: string };

function idsOf(body: AvailableProject[]): Set<string> {
  return new Set(body.map((project) => project.id));
}

/**
 * Restore the seed visibility matrix used by GET /projects/available tests:
 * - ready: unrestricted + readyForExecution
 * - notReady: unrestricted + not ready
 * - roleRestricted: ready + only employeeRole (Welder)
 * - roleRestrictedOther: ready + only employeeRole2 (Operator)
 * - employee1: Welder; employee2: no role
 */
async function resetAvailableVisibilityFixtures(): Promise<void> {
  const prisma = getTestPrisma();

  await prisma.person.update({
    where: { id: FIXTURES.persons.employee1.id },
    data: { employeeRoleId: FIXTURES.employeeRole.id },
  });
  await prisma.person.update({
    where: { id: FIXTURES.persons.employee2.id },
    data: { employeeRoleId: null },
  });
  await prisma.user.update({
    where: { id: FIXTURES.users.employee1.id },
    data: { restrictedProjects: false },
  });
  await prisma.user.update({
    where: { id: FIXTURES.users.employee2.id },
    data: { restrictedProjects: false },
  });

  await prisma.project.update({
    where: { id: FIXTURES.projects.ready.id },
    data: {
      readyForExecution: true,
      deletedAt: null,
      visibleForRoles: { set: [] },
    },
  });
  await prisma.project.update({
    where: { id: FIXTURES.projects.notReady.id },
    data: {
      readyForExecution: false,
      deletedAt: null,
      visibleForRoles: { set: [] },
    },
  });
  await prisma.project.update({
    where: { id: FIXTURES.projects.deleted.id },
    data: {
      readyForExecution: true,
      deletedAt: new Date('2020-01-01T00:00:00.000Z'),
      visibleForRoles: { set: [] },
    },
  });
  await prisma.project.update({
    where: { id: FIXTURES.projects.roleRestricted.id },
    data: {
      readyForExecution: true,
      deletedAt: null,
      visibleForRoles: { set: [{ id: FIXTURES.employeeRole.id }] },
    },
  });
  await prisma.project.update({
    where: { id: FIXTURES.projects.roleRestrictedOther.id },
    data: {
      readyForExecution: true,
      deletedAt: null,
      visibleForRoles: { set: [{ id: FIXTURES.employeeRole2.id }] },
    },
  });
}

describe('GET /projects/available (employee visibility contract)', () => {
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

  beforeEach(async () => {
    await resetAvailableVisibilityFixtures();
  });

  afterAll(async () => {
    await app.close();
  });

  it('employee with a role sees only ready projects that are unrestricted or match their role', async () => {
    // employee1 = Welder (employeeRole)
    const response = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee1Cookie))
      .expect(200);

    const ids = idsOf(response.body);

    // Ready + Toți
    expect(ids.has(FIXTURES.projects.ready.id)).toBe(true);
    // Ready + own role
    expect(ids.has(FIXTURES.projects.roleRestricted.id)).toBe(true);

    // Ready + other role only
    expect(ids.has(FIXTURES.projects.roleRestrictedOther.id)).toBe(false);
    // Not ready (even unrestricted)
    expect(ids.has(FIXTURES.projects.notReady.id)).toBe(false);
    // Soft-deleted
    expect(ids.has(FIXTURES.projects.deleted.id)).toBe(false);
  });

  it('employee without a role sees only unrestricted ready projects', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);

    const ids = idsOf(response.body);

    expect(ids.has(FIXTURES.projects.ready.id)).toBe(true);
    expect(ids.has(FIXTURES.projects.roleRestricted.id)).toBe(false);
    expect(ids.has(FIXTURES.projects.roleRestrictedOther.id)).toBe(false);
    expect(ids.has(FIXTURES.projects.notReady.id)).toBe(false);
    expect(ids.has(FIXTURES.projects.deleted.id)).toBe(false);
  });

  it('does not return a role-matching project that is not ready for execution', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestricted.id}`)
      .set(authHeader(adminCookie))
      .send({ readyForExecution: false })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee1Cookie))
      .expect(200);

    const ids = idsOf(response.body);
    expect(ids.has(FIXTURES.projects.roleRestricted.id)).toBe(false);
    expect(ids.has(FIXTURES.projects.ready.id)).toBe(true);
  });

  it('includes a previously hidden project after it becomes unrestricted and ready', async () => {
    const before = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);
    expect(idsOf(before.body).has(FIXTURES.projects.roleRestrictedOther.id)).toBe(false);

    await request(app.getHttpServer())
      .patch(`/projects/${FIXTURES.projects.roleRestrictedOther.id}`)
      .set(authHeader(adminCookie))
      .send({ visibleForRoleIds: [] })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);
    expect(idsOf(after.body).has(FIXTURES.projects.roleRestrictedOther.id)).toBe(true);
  });

  it('shows role-restricted project to employee after their person role matches', async () => {
    const before = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);
    expect(idsOf(before.body).has(FIXTURES.projects.roleRestrictedOther.id)).toBe(false);

    await request(app.getHttpServer())
      .patch(`/persons/${FIXTURES.persons.employee2.id}`)
      .set(authHeader(adminCookie))
      .send({ employeeRoleId: FIXTURES.employeeRole2.id })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee2Cookie))
      .expect(200);

    const ids = idsOf(after.body);
    expect(ids.has(FIXTURES.projects.ready.id)).toBe(true);
    expect(ids.has(FIXTURES.projects.roleRestrictedOther.id)).toBe(true);
    expect(ids.has(FIXTURES.projects.roleRestricted.id)).toBe(false);
  });

  it('restrictedProjects hides unrestricted projects and keeps role-assigned ones', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${FIXTURES.users.employee1.id}`)
      .set(authHeader(adminCookie))
      .send({ restrictedProjects: true })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employee1Cookie))
      .expect(200);

    const ids = idsOf(response.body);
    expect(ids.has(FIXTURES.projects.ready.id)).toBe(false);
    expect(ids.has(FIXTURES.projects.roleRestricted.id)).toBe(true);
    expect(ids.has(FIXTURES.projects.roleRestrictedOther.id)).toBe(false);
    expect(ids.has(FIXTURES.projects.notReady.id)).toBe(false);

    await request(app.getHttpServer())
      .patch(`/users/${FIXTURES.users.employee1.id}`)
      .set(authHeader(adminCookie))
      .send({ restrictedProjects: false })
      .expect(200);
  });
});
