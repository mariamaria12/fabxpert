import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

// Cookie max-age in milliseconds — keep in sync with JWT_EXPIRY.
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTH_COOKIE_NAME = 'access_token';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<string> {
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

    return this.jwtService.sign({ sub: user.id, role: user.role });
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
