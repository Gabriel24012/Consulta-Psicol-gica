import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { AppointmentsService } from '../appointments/appointments.service';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/schemas/user.schema';
import { CompletePatientInvitationDto, CreatePatientInvitationDto } from './dto/patient-invitation.dto';
import { PatientInvitation } from './schemas/patient-invitation.schema';

@Injectable()
export class PatientInvitationsService {
  constructor(
    @InjectModel(PatientInvitation.name) private readonly invitationModel: Model<PatientInvitation>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreatePatientInvitationDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('El nombre del paciente es obligatorio.');
    }

    const user = await this.usersService.create({ name, role: 'patient', status: 'incomplete' });
    await this.patientsService.createForUser(user._id);
    const invitation = await this.createInvitation(user._id);

    const appointment = dto.appointment
      ? await this.appointmentsService.createForPatientByAdmin({ sub: user._id.toString(), name: user.name }, dto.appointment)
      : null;

    return {
      patient: await this.patientsService.getPatientForViewer(user._id.toString(), {
        sub: user._id.toString(),
        name: user.name,
        email: '',
        role: 'admin',
      }),
      appointment,
      completionUrl: this.buildCompletionUrl(invitation.token),
      expiresAt: invitation.expiresAt,
    };
  }

  async regenerate(patientId: string) {
    const patient = await this.userModel.findOne({ _id: patientId, role: 'patient' }).exec();
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado.');
    }
    if (patient.status === 'active') {
      throw new BadRequestException('El paciente ya completo su perfil.');
    }
    const invitation = await this.createInvitation(patient._id);
    return { completionUrl: this.buildCompletionUrl(invitation.token), expiresAt: invitation.expiresAt };
  }

  async preview(token: string) {
    const { invitation, patient } = await this.findUsableInvitation(token);
    return {
      patientId: patient._id.toString(),
      name: patient.name,
      expiresAt: invitation.expiresAt,
    };
  }

  async complete(token: string, dto: CompletePatientInvitationDto) {
    if (!dto.privacyConsentAccepted) {
      throw new BadRequestException('Debes aceptar el aviso de privacidad para registrarte.');
    }

    const { invitation, patient } = await this.findUsableInvitation(token);
    const passwordHash = await argon2.hash(dto.password);
    const completed = await this.usersService.completeIncompletePatient(patient._id, {
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      privacyConsentAcceptedAt: new Date(),
    });
    invitation.usedAt = new Date();
    await invitation.save();
    return completed;
  }

  private async createInvitation(patientId: Types.ObjectId) {
    await this.invitationModel.updateMany({ patientId, usedAt: { $exists: false } }, { usedAt: new Date() }).exec();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.invitationModel.create({ patientId, tokenHash: this.hashToken(token), expiresAt });
    return { token, expiresAt };
  }

  private async findUsableInvitation(token: string) {
    const invitation = await this.invitationModel.findOne({ tokenHash: this.hashToken(token) }).exec();
    if (!invitation || invitation.usedAt) {
      throw new NotFoundException('Link de perfil no encontrado o ya utilizado.');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Este link ya expiro. Pide a tu psicologa un link nuevo.');
    }
    const patient = await this.userModel.findById(invitation.patientId).exec();
    if (!patient || patient.role !== 'patient') {
      throw new NotFoundException('Paciente no encontrado.');
    }
    if (patient.status === 'active') {
      throw new BadRequestException('Este perfil ya fue completado.');
    }
    return { invitation, patient };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildCompletionUrl(token: string) {
    const baseUrl = this.config.get<string>('WEB_PUBLIC_URL', 'http://localhost:4200').replace(/\/$/, '');
    return `${baseUrl}/completar-perfil/${encodeURIComponent(token)}`;
  }
}
