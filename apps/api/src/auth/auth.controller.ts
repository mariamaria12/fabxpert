import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AUTH_COOKIE_NAME, AuthService, authCookieOptions } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    const { token, cookieMaxAgeMs } = await this.authService.login(
      dto.email,
      dto.password,
      dto.rememberMe ?? false,
    );

    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions(cookieMaxAgeMs));

    return { success: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: boolean } {
    res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
    return { success: true };
  }

  @Get('me')
  getMe(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.authService.getMe(req.user.id);
  }
}
