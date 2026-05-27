import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '@itzel/shared';
import { FieldCryptoService } from '../../common/crypto/field-crypto.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/schemas/user.schema';
import { PatientProfile } from './schemas/patient-profile.schema';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(PatientProfile.name) private readonly profileModel: Model<PatientProfile>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly crypto: FieldCryptoService,
    private readonly usersService: UsersService,
  ) {}

  createForUser(userId: Types.ObjectId) {
    return this.profileModel.create({ userId });
  }

  async list(query: { search?: string; status?: string }) {
    const userFilter: Record<string, unknown> = { role: 'patient' };
    if (query.search) {
      userFilter.$or = [
        { name: new RegExp(query.search, 'i') },
        { email: new RegExp(query.search, 'i') },
        { phone: new RegExp(query.search, 'i') },
      ];
    }

    const users = await this.userModel.find(userFilter).sort({ createdAt: -1 }).lean().exec();
    const userIds = users.map((user) => user._id);
    const profiles = await this.profileModel
      .find({
        userId: { $in: userIds },
        ...(query.status ? { patientStatus: query.status } : {}),
      })
      .lean()
      .exec();
    const profileByUser = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));

    return users
      .filter((user) => profileByUser.has(user._id.toString()))
      .map((user) => ({
        ...user,
        profile: profileByUser.get(user._id.toString()),
      }));
  }

  async getPatientForViewer(patientId: string, viewer: AuthUser) {
    if (viewer.role === 'patient' && viewer.sub !== patientId) {
      throw new ForbiddenException('No puedes consultar datos de otro paciente.');
    }

    const user = await this.userModel.findById(patientId).lean().exec();
    if (!user) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    let profile = await this.profileModel.findOne({ userId: patientId }).lean().exec();
    if (!profile && viewer.role === 'admin' && user.role === 'patient') {
      profile = (await this.profileModel.create({ userId: patientId })).toObject();
    }
    if (!profile) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    return {
      ...user,
      profile: {
        ...profile,
        clinicalPrivateNotes: undefined,
      },
    };
  }

  async updateStatus(patientId: string, patientStatus: string) {
    return this.profileModel
      .findOneAndUpdate({ userId: patientId }, { patientStatus }, { new: true })
      .exec();
  }

  async updateContact(patientId: string, input: { name?: string; email?: string; phone?: string }) {
    await this.usersService.updatePatientContact(patientId, input);
    return this.getPatientForViewer(patientId, { sub: patientId, name: '', email: '', role: 'admin' });
  }

  async updatePackage(patientId: string, totalSessions: number) {
    return this.profileModel
      .findOneAndUpdate({ userId: patientId }, { totalSessions }, { new: true })
      .exec();
  }

  async updateNotes(patientId: string, input: { administrativeNotes?: string; clinicalPrivateNotes?: string }) {
    const update: Record<string, string> = {};
    if (input.administrativeNotes !== undefined) {
      update.administrativeNotes = input.administrativeNotes;
    }
    if (input.clinicalPrivateNotes !== undefined) {
      update.clinicalPrivateNotesEncrypted = this.crypto.encrypt(input.clinicalPrivateNotes);
    }
    return this.profileModel.findOneAndUpdate({ userId: patientId }, update, { new: true }).exec();
  }

  async touchBooked(patientId: string) {
    await this.profileModel
      .findOneAndUpdate({ userId: patientId }, { lastBookedAt: new Date(), patientStatus: 'active' })
      .exec();
  }
}
