import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUTH_COOKIE_NAME } from '../../src/auth/auth.service';

export interface LoginResult {
  cookieHeader: string;
  setCookie: string[];
}

/**
 * Performs POST /auth/login and returns the cookie string for authenticated requests.
 */
export async function login(
  app: INestApplication,
  email: string,
  password: string,
  rememberMe = false,
): Promise<LoginResult> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password, rememberMe });

  const setCookie = response.headers['set-cookie'] ?? [];
  const cookieHeader = extractCookieHeader(setCookie);

  return { cookieHeader, setCookie: Array.isArray(setCookie) ? setCookie : [setCookie] };
}

export function authHeader(cookieHeader: string): { Cookie: string } {
  return { Cookie: cookieHeader };
}

export function extractCookieHeader(setCookie: string | string[]): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies
    .map((entry) => entry.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

export function findAccessTokenCookie(setCookie: string[]): string | undefined {
  return setCookie.find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`));
}

export function cookieHasMaxAge(setCookie: string[]): boolean {
  const accessCookie = findAccessTokenCookie(setCookie);
  if (!accessCookie) {
    return false;
  }
  return /Max-Age=/i.test(accessCookie) || /Expires=/i.test(accessCookie);
}

export function cookieIsSessionOnly(setCookie: string[]): boolean {
  const accessCookie = findAccessTokenCookie(setCookie);
  if (!accessCookie) {
    return false;
  }
  return !/Max-Age=/i.test(accessCookie) && !/Expires=/i.test(accessCookie);
}
