import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { clearAuthCookies, setAuthCookies } from '../../common/http/auth-cookies';
import { AuthUser } from '@itzel/shared';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(dto);
    setAuthCookies(response, this.config, result.accessToken, result.refreshToken);
    return this.toSession(result);
  }

  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    setAuthCookies(response, this.config, result.accessToken, result.refreshToken);
    return this.toSession(result);
  }

  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken =
      request.cookies?.refreshToken ??
      (this.config.get<string>('NODE_ENV') === 'production' ? undefined : request.body?.refreshToken);
    const result = await this.authService.refresh(refreshToken);
    setAuthCookies(response, this.config, result.accessToken, result.refreshToken);
    return this.toSession(result);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    clearAuthCookies(response, this.config);
    return this.authService.logout(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  private toSession(result: AuthResult) {
    return { user: result.user };
  }
}
