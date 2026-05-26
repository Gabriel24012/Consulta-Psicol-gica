import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

function durationToMs(value: string | undefined, fallbackMs: number) {
  if (!value) {
    return fallbackMs;
  }

  const match = value.trim().match(/^(\d+)(ms|s|m|h|d)?$/i);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 'ms').toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

function baseCookieOptions(config: ConfigService) {
  const domain = config.get<string>('COOKIE_DOMAIN');
  return {
    httpOnly: true,
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

export function setAuthCookies(
  response: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
) {
  const baseOptions = baseCookieOptions(config);
  response.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions,
    maxAge: durationToMs(config.get<string>('JWT_ACCESS_EXPIRES_IN'), 15 * 60 * 1000),
  });
  response.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions,
    maxAge: durationToMs(config.get<string>('JWT_REFRESH_EXPIRES_IN'), 7 * 24 * 60 * 60 * 1000),
  });
}

export function clearAuthCookies(response: Response, config: ConfigService) {
  const baseOptions = baseCookieOptions(config);
  response.clearCookie(ACCESS_COOKIE, baseOptions);
  response.clearCookie(REFRESH_COOKIE, baseOptions);
}
