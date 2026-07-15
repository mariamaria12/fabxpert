import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES, NON_EXISTENT_UUID } from './helpers/fixtures';

type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

interface EndpointCase {
  label: string;
  method: HttpMethod;
  path: string;
  body?: Record<string, unknown>;
}

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
    employeeCookie = (
      await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)
    ).cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  const adminOnlyEndpoints: EndpointCase[] = [
    { label: 'companies list', method: 'get', path: '/companies' },
    {
      label: 'companies get by id',
      method: 'get',
      path: `/companies/${FIXTURES.companies.c1.id}`,
    },
    { label: 'projects list', method: 'get', path: '/projects' },
    {
      label: 'projects get by id',
      method: 'get',
      path: `/projects/${FIXTURES.projects.ready.id}`,
    },
    { label: 'persons list', method: 'get', path: '/persons' },
    {
      label: 'persons get by id',
      method: 'get',
      path: `/persons/${FIXTURES.persons.employee1.id}`,
    },
    { label: 'users list', method: 'get', path: '/users' },
    {
      label: 'users get by id',
      method: 'get',
      path: `/users/${FIXTURES.users.employee1.id}`,
    },
    { label: 'timesheets admin list', method: 'get', path: '/timesheets' },
    {
      label: 'activities get by id',
      method: 'get',
      path: `/activities/${FIXTURES.activities.active.id}`,
    },
    {
      label: 'activities create',
      method: 'post',
      path: '/activities',
      body: { name: 'E2E Temp Activity Auth' },
    },
    {
      label: 'activities patch',
      method: 'patch',
      path: `/activities/${FIXTURES.activities.active.id}`,
      body: { name: FIXTURES.activities.active.name },
    },
    {
      label: 'activities delete',
      method: 'delete',
      path: `/activities/${NON_EXISTENT_UUID}`,
    },
    {
      label: 'employee-roles get by id',
      method: 'get',
      path: `/employee-roles/${FIXTURES.employeeRole.id}`,
    },
    {
      label: 'employee-roles create',
      method: 'post',
      path: '/employee-roles',
      body: { name: 'E2E Temp Role Auth' },
    },
    {
      label: 'employee-roles patch',
      method: 'patch',
      path: `/employee-roles/${FIXTURES.employeeRole.id}`,
      body: { name: FIXTURES.employeeRole.name },
    },
    {
      label: 'employee-roles delete',
      method: 'delete',
      path: `/employee-roles/${NON_EXISTENT_UUID}`,
    },
  ];

  const bothRoleEndpoints: EndpointCase[] = [
    { label: 'activities list', method: 'get', path: '/activities' },
    { label: 'employee-roles list', method: 'get', path: '/employee-roles' },
    { label: 'projects available', method: 'get', path: '/projects/available' },
    {
      label: 'timesheets create',
      method: 'post',
      path: '/timesheets',
      body: {
        projectId: FIXTURES.projects.ready.id,
        durationMinutes: 30,
      },
    },
    { label: 'timesheets mine', method: 'get', path: '/timesheets/mine' },
  ];

  async function send(
    method: HttpMethod,
    path: string,
    cookie?: string,
    body?: Record<string, unknown>,
  ) {
    const req = request(app.getHttpServer())[method](path);
    if (cookie) {
      req.set(authHeader(cookie));
    }
    if (body !== undefined) {
      req.send(body);
    }
    return req;
  }

  describe.each(adminOnlyEndpoints)('admin-only: $label', ({ method, path, body }) => {
    it('unauthenticated → 401', async () => {
      const response = await send(method, path, undefined, body);
      expect(response.status).toBe(401);
    });

    it('EMPLOYEE → 403', async () => {
      const response = await send(method, path, employeeCookie, body);
      expect(response.status).toBe(403);
    });

    it('ADMIN → not 401/403', async () => {
      const response = await send(method, path, adminCookie, body);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe.each(bothRoleEndpoints)('both roles: $label', ({ method, path, body }) => {
    it('EMPLOYEE → not 401/403', async () => {
      const response = await send(method, path, employeeCookie, body);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  it('includeInactive on GET /activities: ADMIN sees inactive, EMPLOYEE filtered', async () => {
    const employeeDefault = await request(app.getHttpServer())
      .get('/activities')
      .set(authHeader(employeeCookie));
    const employeeWithParam = await request(app.getHttpServer())
      .get('/activities?includeInactive=true')
      .set(authHeader(employeeCookie));

    expect(employeeDefault.status).toBe(200);
    expect(employeeWithParam.status).toBe(200);
    expect(employeeWithParam.body).toEqual(employeeDefault.body);
    expect(
      employeeDefault.body.some(
        (a: { id: string }) => a.id === FIXTURES.activities.inactive.id,
      ),
    ).toBe(false);

    const adminDefault = await request(app.getHttpServer())
      .get('/activities')
      .set(authHeader(adminCookie));
    const adminWithParam = await request(app.getHttpServer())
      .get('/activities?includeInactive=true')
      .set(authHeader(adminCookie));

    expect(adminDefault.status).toBe(200);
    expect(adminWithParam.status).toBe(200);
    expect(
      adminDefault.body.some(
        (a: { id: string }) => a.id === FIXTURES.activities.inactive.id,
      ),
    ).toBe(false);
    expect(
      adminWithParam.body.some(
        (a: { id: string }) => a.id === FIXTURES.activities.inactive.id,
      ),
    ).toBe(true);
  });

  it('includeInactive on GET /employee-roles: ADMIN sees inactive after deactivation', async () => {
    await request(app.getHttpServer())
      .patch(`/employee-roles/${FIXTURES.employeeRole.id}`)
      .set(authHeader(adminCookie))
      .send({ isActive: false })
      .expect(200);

    const employeeList = await request(app.getHttpServer())
      .get('/employee-roles?includeInactive=true')
      .set(authHeader(employeeCookie));
    expect(employeeList.body.some((r: { id: string }) => r.id === FIXTURES.employeeRole.id)).toBe(
      false,
    );

    const adminDefault = await request(app.getHttpServer())
      .get('/employee-roles')
      .set(authHeader(adminCookie));
    const adminInactive = await request(app.getHttpServer())
      .get('/employee-roles?includeInactive=true')
      .set(authHeader(adminCookie));

    expect(adminDefault.body.some((r: { id: string }) => r.id === FIXTURES.employeeRole.id)).toBe(
      false,
    );
    expect(
      adminInactive.body.find((r: { id: string }) => r.id === FIXTURES.employeeRole.id)?.isActive,
    ).toBe(false);

    await request(app.getHttpServer())
      .patch(`/employee-roles/${FIXTURES.employeeRole.id}`)
      .set(authHeader(adminCookie))
      .send({ isActive: true });
  });

  it('GET /projects/available as EMPLOYEE returns ProjectOptionDto fields only', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employeeCookie));

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);

    for (const project of response.body) {
      expect(Object.keys(project).sort()).toEqual(['code', 'color', 'company', 'id', 'name']);
      expect(project.company).toEqual({ name: expect.any(String) });
      expect(project.status).toBeUndefined();
      expect(project.companyId).toBeUndefined();
    }

    expect(
      response.body.some((p: { id: string }) => p.id === FIXTURES.projects.ready.id),
    ).toBe(true);
    expect(
      response.body.some((p: { id: string }) => p.id === FIXTURES.projects.notReady.id),
    ).toBe(false);
    expect(
      response.body.some((p: { id: string }) => p.id === FIXTURES.projects.deleted.id),
    ).toBe(false);
  });
});
