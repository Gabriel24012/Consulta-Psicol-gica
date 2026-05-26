import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService refresh', () => {
  it('uses the refresh token subject instead of a caller supplied user id', async () => {
    const usersService = {
      findByIdWithRefreshToken: jest.fn().mockResolvedValue({
        _id: { toString: () => 'token-user' },
        email: 'patient@example.com',
        role: 'patient',
        name: 'Patient',
        status: 'active',
        refreshTokenHash: 'hash',
      }),
      saveRefreshToken: jest.fn(),
    };
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'token-user' }),
      signAsync: jest.fn().mockResolvedValueOnce('access').mockResolvedValueOnce('refresh-new'),
    };
    const config = {
      get: jest.fn((_key: string, fallback?: string) => fallback),
      getOrThrow: jest.fn((key: string) => key),
    };
    jest.mocked(argon2.verify).mockResolvedValue(true);
    jest.mocked(argon2.hash).mockResolvedValue('new-hash');

    const service = new AuthService(usersService as any, {} as any, jwt as any, config as any);
    const result = await service.refresh('refresh-token');

    expect(jwt.verifyAsync).toHaveBeenCalledWith('refresh-token', { secret: 'JWT_REFRESH_SECRET' });
    expect(usersService.findByIdWithRefreshToken).toHaveBeenCalledWith('token-user');
    expect(result.user.sub).toBe('token-user');
  });

  it('rejects invalid refresh tokens', async () => {
    const jwt = { verifyAsync: jest.fn().mockRejectedValue(new Error('bad token')) };
    const config = { getOrThrow: jest.fn((key: string) => key) };
    const service = new AuthService({} as any, {} as any, jwt as any, config as any);

    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService login messages', () => {
  const jwt = { signAsync: jest.fn() };
  const config = {
    get: jest.fn((_key: string, fallback?: string) => fallback),
    getOrThrow: jest.fn((key: string) => key),
  };

  it('does not reveal when an account does not exist', async () => {
    const usersService = {
      findByEmailWithPassword: jest.fn().mockResolvedValue(null),
    };
    const service = new AuthService(usersService as any, {} as any, jwt as any, config as any);

    await expect(service.login({ email: 'missing@example.com', password: 'password' })).rejects.toThrow(
      'Correo o contrasena incorrectos.',
    );
  });

  it('does not reveal when the password does not match', async () => {
    const usersService = {
      findByEmailWithPassword: jest.fn().mockResolvedValue({
        _id: { toString: () => 'patient-id' },
        email: 'patient@example.com',
        role: 'patient',
        name: 'Patient',
        status: 'active',
        passwordHash: 'hash',
      }),
    };
    jest.mocked(argon2.verify).mockResolvedValue(false);
    const service = new AuthService(usersService as any, {} as any, jwt as any, config as any);

    await expect(service.login({ email: 'patient@example.com', password: 'wrong' })).rejects.toThrow(
      'Correo o contrasena incorrectos.',
    );
  });
});
