import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Project create finisaj (e2e)', () => {
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

  function createProject(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({ companyId: FIXTURES.companies.c1.id, ...body })
      .expect(201);
  }

  it('stores finisaj given at creation', async () => {
    const response = await createProject({
      name: 'E2E Finisaj Project',
      code: `E2E-FINISAJ-${Date.now()}`,
      finisaj: 'ZINCARE_RAL9002',
    });

    expect(response.body.finisaj).toBe('ZINCARE_RAL9002');

    // The list has to carry it too — the projects table sorts on this column.
    const listed = await request(app.getHttpServer())
      .get(`/projects/${response.body.id}`)
      .set(authHeader(adminCookie))
      .expect(200);

    expect(listed.body.finisaj).toBe('ZINCARE_RAL9002');
  });

  it('leaves finisaj null when omitted', async () => {
    const response = await createProject({
      name: 'E2E No Finisaj Project',
      code: `E2E-NO-FINISAJ-${Date.now()}`,
    });

    expect(response.body.finisaj).toBeNull();
  });

  it('stores null for a blank finisaj', async () => {
    const response = await createProject({
      name: 'E2E Blank Finisaj Project',
      code: `E2E-BLANK-FINISAJ-${Date.now()}`,
      finisaj: '   ',
    });

    expect(response.body.finisaj).toBeNull();
  });

  it('rejects a finisaj longer than 100 characters', async () => {
    await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({
        name: 'E2E Long Finisaj Project',
        code: `E2E-LONG-FINISAJ-${Date.now()}`,
        companyId: FIXTURES.companies.c1.id,
        finisaj: 'X'.repeat(101),
      })
      .expect(400);
  });
});
