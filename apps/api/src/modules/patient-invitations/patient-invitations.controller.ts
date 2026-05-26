import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthUser } from '@itzel/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { setAuthCookies } from '../../common/http/auth-cookies';
import { AuthService } from '../auth/auth.service';
import { CompletePatientInvitationDto, CreatePatientInvitationDto } from './dto/patient-invitation.dto';
import { PatientInvitationsService } from './patient-invitations.service';

@Controller('patient-invitations')
export class PatientInvitationsController {
  constructor(
    private readonly invitationsService: PatientInvitationsService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('admin')
  create(@Body() dto: CreatePatientInvitationDto) {
    return this.invitationsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':patientId/regenerate')
  @Roles('admin')
  regenerate(@Param('patientId') patientId: string) {
    return this.invitationsService.regenerate(patientId);
  }

  @Get(':token')
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  preview(@Param('token') token: string) {
    return this.invitationsService.preview(token);
  }

  @Post(':token/complete')
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  async complete(@Param('token') token: string, @Body() dto: CompletePatientInvitationDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.invitationsService.complete(token, dto);
    const authUser: AuthUser = {
      sub: user._id.toString(),
      email: user.email ?? '',
      role: user.role,
      name: user.name,
    };
    const result = await this.authService.issueTokens(authUser);
    setAuthCookies(response, this.config, result.accessToken, result.refreshToken);
    return { user: result.user };
  }
}
