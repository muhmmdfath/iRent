import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest, Public, sessionCookieName } from './auth.guard';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  private cookie(response: Response, token: string): void {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    response.cookie(sessionCookieName(production), token, {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    response.setHeader('Cache-Control', 'no-store');
  }
  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(dto);
    if (!('token' in result)) throw new Error('Session missing.');
    this.cookie(response, result.token);
    return { user: result.user, csrfToken: result.csrfToken };
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto.identity, dto.password);
    this.cookie(response, result.token);
    return { user: result.user, csrfToken: result.csrfToken };
  }
  @Get('session')
  session(@Req() req: AuthRequest) {
    return { user: req.auth.user, csrfToken: req.auth.csrfToken };
  }
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(req.auth);
    const production = this.config.get<string>('NODE_ENV') === 'production';
    response.clearCookie(sessionCookieName(production), {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
    });
  }
}
