import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { isProjectColorPreset } from '@fabxpert/shared/projectColor';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Project create default color (e2e)', () => {
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

  it('assigns a random preset color when color is omitted', async () => {
    const code = `E2E-COLOR-${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({
        name: 'E2E Default Color Project',
        code,
        companyId: FIXTURES.companies.c1.id,
      })
      .expect(201);

    expect(response.body.color).toBeTruthy();
    expect(isProjectColorPreset(response.body.color)).toBe(true);
  });

  it('keeps an explicitly provided color', async () => {
    const code = `E2E-COLOR-EXPLICIT-${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({
        name: 'E2E Explicit Color Project',
        code,
        companyId: FIXTURES.companies.c1.id,
        color: '#3B7EA1',
      })
      .expect(201);

    expect(response.body.color).toBe('#3B7EA1');
  });
});
