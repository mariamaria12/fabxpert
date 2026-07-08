import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const AUTH_COOKIE_NAME = 'access_token';

/** Cookie options for credentialed cross-origin auth (web on Vercel, API on Railway). */
export function authCookieOptions(maxAgeMs?: number): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    // Lax blocks the cookie on cross-site fetch (vercel.app → railway.app); None+Secure is required.
    sameSite: isProduction ? 'none' : 'lax',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export interface LoginResult {
  token: string;
  /** Milliseconds for a persistent cookie; omit for a session cookie (no maxAge). */
  cookieMaxAgeMs?: number;
}

/** Parse a duration string like "30d", "1h", "365d" into milliseconds. */
function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid JWT duration format: "${duration}"`);
  }
  const value = Number.parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid JWT duration unit: "${match[2]}"`);
  }
}

function getRememberExpiry(role: Role): string {
  if (role === 'ADMIN') {
    const expiry = process.env.JWT_REMEMBER_EXPIRY_ADMIN;
    if (!expiry) {
      throw new Error('JWT_REMEMBER_EXPIRY_ADMIN environment variable is not set.');
    }
    return expiry;
  }
  const expiry = process.env.JWT_REMEMBER_EXPIRY_EMPLOYEE;
  if (!expiry) {
    throw new Error('JWT_REMEMBER_EXPIRY_EMPLOYEE environment variable is not set.');
  }
  return expiry;
}

function getSessionExpiry(): string {
  const expiry = process.env.JWT_SESSION_EXPIRY;
  if (!expiry) {
    throw new Error('JWT_SESSION_EXPIRY environment variable is not set.');
  }
  return expiry;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, role: true, isActive: true },
    });

    // Always run bcrypt.compare to prevent timing-based user enumeration.
    const DUMMY_HASH = '$2a$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const passwordsMatch = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !user.isActive || !passwordsMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (rememberMe) {
      const expiresIn = getRememberExpiry(user.role);
      const token = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn });
      return { token, cookieMaxAgeMs: parseDurationMs(expiresIn) };
    }

    const expiresIn = getSessionExpiry();
    const token = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn });
    return { token };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
