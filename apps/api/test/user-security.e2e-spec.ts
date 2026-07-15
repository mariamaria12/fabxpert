import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('User security (e2e)', () => {
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

  function assertNoPasswordHash(payload: unknown): void {
    const json = JSON.stringify(payload);
    expect(json.includes('passwordHash')).toBe(false);
  }

  it('no /users response contains passwordHash', async () => {
    const list = await request(app.getHttpServer())
      .get('/users')
      .set(authHeader(adminCookie));
    expect(list.status).toBe(200);
    assertNoPasswordHash(list.body);

    const getOne = await request(app.getHttpServer())
      .get(`/users/${FIXTURES.users.employee1.id}`)
      .set(authHeader(adminCookie));
    expect(getOne.status).toBe(200);
    assertNoPasswordHash(getOne.body);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set(authHeader(adminCookie))
      .send({
        email: 'new-user@e2e.test',
        password: E2E_PASSWORD,
        role: 'EMPLOYEE',
        personId: FIXTURES.persons.unassigned.id,
      });
    expect(created.status).toBe(201);
    assertNoPasswordHash(created.body);

    const updated = await request(app.getHttpServer())
      .patch(`/users/${created.body.id}`)
      .set(authHeader(adminCookie))
      .send({ email: 'new-user-updated@e2e.test' });
    expect(updated.status).toBe(200);
    assertNoPasswordHash(updated.body);
  });

  it('GET /users supports search by email and person name', async () => {
    const byEmail = await request(app.getHttpServer())
      .get('/users')
      .query({ search: 'employee1@e2e.test', pageSize: 50 })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(byEmail.body.meta.total).toBe(1);
    expect(byEmail.body.data[0].id).toBe(FIXTURES.users.employee1.id);

    const byName = await request(app.getHttpServer())
      .get('/users')
      .query({ search: 'EmployeeOne', pageSize: 50 })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(byName.body.meta.total).toBe(1);
    expect(byName.body.data[0].id).toBe(FIXTURES.users.employee1.id);

    const noMatch = await request(app.getHttpServer())
      .get('/users')
      .query({ search: 'zzznomatchuser', pageSize: 50 })
      .set(authHeader(adminCookie))
      .expect(200);

    expect(noMatch.body.meta.total).toBe(0);
    expect(noMatch.body.data).toHaveLength(0);
  });

  it('ADMIN self-protection: cannot deactivate, demote, or delete own account', async () => {
    const deactivate = await request(app.getHttpServer())
      .patch(`/users/${FIXTURES.users.admin.id}`)
      .set(authHeader(adminCookie))
      .send({ isActive: false });
    expect(deactivate.status).toBe(400);
    expect(deactivate.body.message).toBe('You cannot deactivate your own account');

    const demote = await request(app.getHttpServer())
      .patch(`/users/${FIXTURES.users.admin.id}`)
      .set(authHeader(adminCookie))
      .send({ role: 'EMPLOYEE' });
    expect(demote.status).toBe(400);
    expect(demote.body.message).toBe('You cannot demote your own account');

    const remove = await request(app.getHttpServer())
      .delete(`/users/${FIXTURES.users.admin.id}`)
      .set(authHeader(adminCookie));
    expect(remove.status).toBe(400);
    expect(remove.body.message).toBe('You cannot delete your own account');
  });

  it('duplicate email → 409; second user for same person → 409', async () => {
    const duplicateEmail = await request(app.getHttpServer())
      .post('/users')
      .set(authHeader(adminCookie))
      .send({
        email: FIXTURES.users.employee1.email,
        password: E2E_PASSWORD,
        role: 'EMPLOYEE',
        personId: FIXTURES.persons.unassigned.id,
      });
    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.message).toBe('A user with this email already exists');

    const duplicatePerson = await request(app.getHttpServer())
      .post('/users')
      .set(authHeader(adminCookie))
      .send({
        email: 'another@e2e.test',
        password: E2E_PASSWORD,
        role: 'EMPLOYEE',
        personId: FIXTURES.persons.employee1.id,
      });
    expect(duplicatePerson.status).toBe(409);
    expect(duplicatePerson.body.message).toBe('This person already has a user account');
  });

  it('deactivated employee session is rejected on the next request', async () => {
    const { cookieHeader } = await login(
      app,
      FIXTURES.users.employee2.email,
      E2E_PASSWORD,
    );

    await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(cookieHeader))
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/users/${FIXTURES.users.employee2.id}`)
      .set(authHeader(adminCookie))
      .send({ isActive: false })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(cookieHeader));

    expect(me.status).toBe(401);

    await request(app.getHttpServer())
      .patch(`/users/${FIXTURES.users.employee2.id}`)
      .set(authHeader(adminCookie))
      .send({ isActive: true });
  });
});
