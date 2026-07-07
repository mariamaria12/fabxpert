import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Lookup revive on create (e2e)', () => {
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

  describe('Activity', () => {
    const reviveName = 'E2E Revive Activity';

    it('revives a soft-deleted activity with the same name and id', async () => {
      const created = await request(app.getHttpServer())
        .post('/activities')
        .set(authHeader(adminCookie))
        .send({ name: reviveName, color: '#B5533C', isActive: true })
        .expect(201);

      const originalId = created.body.id as string;

      await request(app.getHttpServer())
        .delete(`/activities/${originalId}`)
        .set(authHeader(adminCookie))
        .expect(204);

      await request(app.getHttpServer())
        .get(`/activities/${originalId}`)
        .set(authHeader(adminCookie))
        .expect(404);

      const revived = await request(app.getHttpServer())
        .post('/activities')
        .set(authHeader(adminCookie))
        .send({ name: reviveName, color: '#3B7EA1', isActive: true })
        .expect(201);

      expect(revived.body.id).toBe(originalId);
      expect(revived.body.name).toBe(reviveName);
      expect(revived.body.color).toBe('#3B7EA1');
      expect(revived.body.isActive).toBe(true);

      const fetched = await request(app.getHttpServer())
        .get(`/activities/${originalId}`)
        .set(authHeader(adminCookie))
        .expect(200);

      expect(fetched.body.id).toBe(originalId);

      const list = await request(app.getHttpServer())
        .get('/activities?includeInactive=true')
        .set(authHeader(adminCookie))
        .expect(200);

      expect(list.body.some((row: { id: string }) => row.id === originalId)).toBe(true);
    });

    it('returns 409 when creating a duplicate active activity name', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities')
        .set(authHeader(adminCookie))
        .send({ name: FIXTURES.activities.active.name })
        .expect(409);

      expect(response.body.message).toBe('An activity with this name already exists');
    });
  });

  describe('EmployeeRole', () => {
    const reviveName = 'E2E Revive Role';

    it('revives a soft-deleted employee role with the same name and id', async () => {
      const created = await request(app.getHttpServer())
        .post('/employee-roles')
        .set(authHeader(adminCookie))
        .send({ name: reviveName, isActive: false })
        .expect(201);

      const originalId = created.body.id as string;

      await request(app.getHttpServer())
        .delete(`/employee-roles/${originalId}`)
        .set(authHeader(adminCookie))
        .expect(204);

      const revived = await request(app.getHttpServer())
        .post('/employee-roles')
        .set(authHeader(adminCookie))
        .send({ name: reviveName, isActive: true })
        .expect(201);

      expect(revived.body.id).toBe(originalId);
      expect(revived.body.name).toBe(reviveName);
      expect(revived.body.isActive).toBe(true);

      const list = await request(app.getHttpServer())
        .get('/employee-roles?includeInactive=true')
        .set(authHeader(adminCookie))
        .expect(200);

      expect(list.body.some((row: { id: string }) => row.id === originalId)).toBe(true);
    });

    it('returns 409 when creating a duplicate active employee role name', async () => {
      const response = await request(app.getHttpServer())
        .post('/employee-roles')
        .set(authHeader(adminCookie))
        .send({ name: FIXTURES.employeeRole.name })
        .expect(409);

      expect(response.body.message).toBe('An employee role with this name already exists');
    });
  });
});
