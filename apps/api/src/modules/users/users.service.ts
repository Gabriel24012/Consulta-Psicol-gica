import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@itzel/shared';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async create(input: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role?: UserRole;
    privacyConsentAcceptedAt?: Date;
  }) {
    const exists = await this.userModel.exists({ email: input.email.toLowerCase() });
    if (exists) {
      throw new ConflictException('El correo ya está registrado.');
    }

    return this.userModel.create({
      ...input,
      email: input.email.toLowerCase(),
      role: input.role ?? 'patient',
    });
  }

  findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  findById(id: string | Types.ObjectId) {
    return this.userModel.findById(id).exec();
  }

  findByIdWithRefreshToken(id: string | Types.ObjectId) {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async findAdmin() {
    const admin = await this.userModel.findOne({ role: 'admin', status: 'active' }).exec();
    if (!admin) {
      throw new NotFoundException('No existe un psicólogo administrador activo.');
    }
    return admin;
  }

  async saveRefreshToken(userId: string, refreshTokenHash?: string) {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash }).exec();
  }
}
