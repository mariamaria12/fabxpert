import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

function personDisplayName(row: { firstName: string; lastName: string }): string {
  return `${row.lastName} ${row.firstName}`;
}

describe('Person list sort (e2e)', () => {
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

  it('sorts by name ascending by default and accepts sortBy/sortOrder', async () => {
    const defaultList = await request(app.getHttpServer())
      .get('/persons')
      .query({ pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    const defaultNames = defaultList.body.data.map(personDisplayName);
    expect(defaultNames.length).toBeGreaterThan(1);
    expect([...defaultNames].sort((a, b) => a.localeCompare(b))).toEqual(defaultNames);

    const byNameDesc = await request(app.getHttpServer())
      .get('/persons')
      .query({ sortBy: 'name', sortOrder: 'desc', pageSize: '20' })
      .set(authHeader(adminCookie))
      .expect(200);

    const descNames = byNameDesc.body.data.map(personDisplayName);
    expect([...descNames].sort((a, b) => b.localeCompare(a))).toEqual(descNames);
    expect(descNames[0]).not.toBe(defaultNames[0]);
  });

  it('splits the list by whether the person has an account that can sign in', async () => {
    const list = async (account: string) => {
      const response = await request(app.getHttpServer())
        .get('/persons')
        .query({ account, pageSize: '50' })
        .set(authHeader(adminCookie))
        .expect(200);
      return response.body.data.map((row: { id: string }) => row.id) as string[];
    };

    const active = await list('active');
    const none = await list('none');

    expect(active).toContain(FIXTURES.persons.employee1.id);
    expect(active).not.toContain(FIXTURES.persons.inactive.id);
    expect(active).not.toContain(FIXTURES.persons.unassigned.id);
    // A deactivated account and no account at all land in the same table.
    expect(none).toEqual(
      expect.arrayContaining([FIXTURES.persons.inactive.id, FIXTURES.persons.unassigned.id]),
    );
    expect(none).not.toContain(FIXTURES.persons.employee1.id);
  });

  it('rejects invalid sortBy', async () => {
    const response = await request(app.getHttpServer())
      .get('/persons')
      .query({ sortBy: 'email' })
      .set(authHeader(adminCookie));

    expect(response.status).toBe(400);
  });
});
