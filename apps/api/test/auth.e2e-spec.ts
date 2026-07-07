import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import {
  authHeader,
  cookieHasMaxAge,
  cookieIsSessionOnly,
  login,
} from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('login with valid ADMIN credentials → 200 + httpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: FIXTURES.users.admin.email,
        password: E2E_PASSWORD,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    const rawSetCookie = response.headers['set-cookie'];
    const setCookie = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : rawSetCookie
        ? [rawSetCookie]
        : [];
    expect(setCookie.some((c: string) => c.startsWith('access_token='))).toBe(true);
    expect(setCookie.some((c: string) => /HttpOnly/i.test(c))).toBe(true);
  });

  it('login with wrong password and unknown email → same generic 401', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: FIXTURES.users.admin.email,
        password: 'wrong-password',
      });

    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'nobody@e2e.test',
        password: E2E_PASSWORD,
      });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.message).toBe('Invalid credentials');
  });

  it('login with inactive user → same generic 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: FIXTURES.users.inactive.email,
        password: E2E_PASSWORD,
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('GET /auth/me without cookie → 401; with cookie → user shape without passwordHash', async () => {
    const unauthenticated = await request(app.getHttpServer()).get('/auth/me');
    expect(unauthenticated.status).toBe(401);

    const { cookieHeader } = await login(
      app,
      FIXTURES.users.admin.email,
      E2E_PASSWORD,
    );

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(cookieHeader));

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      id: FIXTURES.users.admin.id,
      email: FIXTURES.users.admin.email,
      role: 'ADMIN',
      isActive: true,
      person: {
        id: FIXTURES.persons.admin.id,
        firstName: 'E2E',
        lastName: 'Admin',
      },
    });
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('logout clears cookie — subsequent /auth/me → 401', async () => {
    const { cookieHeader } = await login(
      app,
      FIXTURES.users.employee1.email,
      E2E_PASSWORD,
    );

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set(authHeader(cookieHeader));

    expect(logout.status).toBe(200);

    const clearedCookies = logout.headers['set-cookie'] ?? [];
    const cleared = Array.isArray(clearedCookies) ? clearedCookies : [clearedCookies];
    expect(
      cleared.some(
        (entry: string) =>
          entry.startsWith('access_token=') &&
          (entry.includes('Max-Age=0') || /Expires=Thu, 01 Jan 1970/i.test(entry)),
      ),
    ).toBe(true);

    const me = await request(app.getHttpServer()).get('/auth/me');

    expect(me.status).toBe(401);
  });

  it('rememberMe: true → cookie has expiry; rememberMe: false → session cookie', async () => {
    const remember = await login(
      app,
      FIXTURES.users.admin.email,
      E2E_PASSWORD,
      true,
    );
    expect(cookieHasMaxAge(remember.setCookie)).toBe(true);

    const session = await login(
      app,
      FIXTURES.users.admin.email,
      E2E_PASSWORD,
      false,
    );
    expect(cookieIsSessionOnly(session.setCookie)).toBe(true);
  });
});
