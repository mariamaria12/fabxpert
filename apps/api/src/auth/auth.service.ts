import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const AUTH_COOKIE_NAME = 'access_token';

/** True when the API serves credentialed cross-origin clients (Vercel → Railway). */
function useCrossOriginCookies(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  // Railway often omits NODE_ENV at runtime; RAILWAY_ENVIRONMENT is always set when deployed.
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  return false;
}

/** Cookie options for credentialed cross-origin auth (web on Vercel, API on Railway). */
export function authCookieOptions(maxAgeMs?: number): CookieOptions {
  const crossOrigin = useCrossOriginCookies();
  return {
    httpOnly: true,
    secure: crossOrigin,
    // Lax blocks the cookie on cross-site fetch (vercel.app → railway.app); None+Secure is required.
    sameSite: crossOrigin ? 'none' : 'lax',
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
            employeeRole: {
              select: {
                id: true,
                name: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const role = user.person?.employeeRole;
    const employeeRole =
      role && role.isActive && !role.deletedAt
        ? { id: role.id, name: role.name }
        : null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      person: user.person
        ? {
            id: user.person.id,
            firstName: user.person.firstName,
            lastName: user.person.lastName,
            email: user.person.email,
            phone: user.person.phone,
            employeeRole,
          }
        : null,
    };
  }
}
