import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserCache } from './auth-user-cache.service';

export interface JwtPayload {
  sub: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  role: string;
}

const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.['access_token'] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AuthUserCache,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set. Refusing to start.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const cached = this.cache.get(payload.sub);
    if (cached !== undefined) {
      if (!cached) {
        throw new UnauthorizedException();
      }
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    });

    const principal =
      user && user.isActive ? { id: user.id, role: user.role } : null;
    this.cache.set(payload.sub, principal);

    if (!principal) {
      throw new UnauthorizedException();
    }
    return principal;
  }
}
