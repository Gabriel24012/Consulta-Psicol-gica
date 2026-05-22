import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthUser } from '@itzel/shared';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.privacyConsentAccepted) {
      throw new BadRequestException('Debes aceptar el aviso de privacidad para registrarte.');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      privacyConsentAcceptedAt: new Date(),
    });
    await this.patientsService.createForUser(user._id);
    return this.issueTokens({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    return this.issueTokens({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Sesion invalida.');
    }

    const current = await this.usersService.findByIdWithRefreshToken(payload.sub);
    if (!current || current.status !== 'active' || !current.refreshTokenHash || !refreshToken) {
      throw new UnauthorizedException('Sesión inválida.');
    }
    const ok = await argon2.verify(current.refreshTokenHash, refreshToken);
    if (!ok) {
      throw new UnauthorizedException('Sesión inválida.');
    }
    return this.issueTokens({
      sub: current._id.toString(),
      email: current.email,
      role: current.role,
      name: current.name,
    });
  }

  async logout(userId: string) {
    await this.usersService.saveRefreshToken(userId, undefined);
    return { ok: true };
  }

  private async issueTokens(user: AuthUser) {
    const accessToken = await this.jwt.signAsync(user, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
    const refreshToken = await this.jwt.signAsync({ sub: user.sub }, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });
    await this.usersService.saveRefreshToken(user.sub, await argon2.hash(refreshToken));
    return { accessToken, refreshToken, user };
  }
}
