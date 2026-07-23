import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../jwt.strategy';

/** JWT user (`{ id, role }`), with fallback to payload `sub`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedUser & { sub?: string };
    }>();
    const raw = request.user;
    const id = raw?.id ?? raw?.sub;
    if (!raw || !id || !raw.role) {
      throw new UnauthorizedException();
    }
    return { id, role: raw.role };
  },
);
