import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole, UserStatus } from '@itzel/shared';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async create(input: {
    name: string;
    email?: string;
    phone?: string;
    passwordHash?: string;
    role?: UserRole;
    status?: UserStatus;
    privacyConsentAcceptedAt?: Date;
  }) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const normalizedPhone = this.normalizePhone(input.phone);
    if (normalizedEmail) {
      const exists = await this.userModel.exists({ email: normalizedEmail });
      if (exists) {
        throw new ConflictException('El correo ya esta registrado.');
      }
    }
    if (normalizedPhone) {
      const exists = await this.phoneExists(normalizedPhone);
      if (exists) {
        throw new ConflictException('El telefono ya esta registrado.');
      }
    }

    const userToCreate: Record<string, unknown> = {
      ...input,
      phone: input.phone?.trim(),
      role: input.role ?? 'patient',
      status: input.status ?? 'active',
    };
    if (normalizedEmail) {
      userToCreate.email = normalizedEmail;
    } else {
      delete userToCreate.email;
    }
    if (normalizedPhone) {
      userToCreate.phoneNormalized = normalizedPhone;
    } else {
      delete userToCreate.phone;
      delete userToCreate.phoneNormalized;
    }

    return this.userModel.create(userToCreate);
  }

  findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: this.normalizeEmail(email) })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  findById(id: string | Types.ObjectId) {
    return this.userModel.findById(id).exec();
  }

  findByIdWithRefreshToken(id: string | Types.ObjectId) {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async completeIncompletePatient(
    userId: string | Types.ObjectId,
    input: { name: string; email: string; phone: string; passwordHash: string; privacyConsentAcceptedAt: Date },
  ) {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('El nombre del paciente es obligatorio.');
    }
    const normalizedEmail = this.normalizeEmail(input.email);
    const normalizedPhone = this.normalizePhone(input.phone);
    const emailExists = await this.userModel.exists({ email: normalizedEmail, _id: { $ne: userId } });
    if (emailExists) {
      throw new ConflictException('El correo ya esta registrado.');
    }
    if (normalizedPhone) {
      const phoneExists = await this.phoneExists(normalizedPhone, userId);
      if (phoneExists) {
        throw new ConflictException('El telefono ya esta registrado.');
      }
    }

    const user = await this.userModel.findById(userId).select('+passwordHash').exec();
    if (!user) {
      throw new NotFoundException('Paciente no encontrado.');
    }
    user.name = name;
    user.email = normalizedEmail;
    user.phone = input.phone.trim();
    user.phoneNormalized = normalizedPhone;
    user.passwordHash = input.passwordHash;
    user.status = 'active';
    user.privacyConsentAcceptedAt = input.privacyConsentAcceptedAt;
    return user.save();
  }

  async updatePatientContact(
    userId: string | Types.ObjectId,
    input: { name?: string; email?: string; phone?: string },
  ) {
    const user = await this.userModel.findOne({ _id: userId, role: 'patient' }).exec();
    if (!user) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre del paciente es obligatorio.');
      }
      user.name = name;
    }

    if (input.email !== undefined) {
      const normalizedEmail = this.normalizeEmail(input.email);
      if (normalizedEmail) {
        const emailExists = await this.userModel.exists({ email: normalizedEmail, _id: { $ne: user._id } });
        if (emailExists) {
          throw new ConflictException('El correo ya esta registrado.');
        }
      }
      user.email = normalizedEmail;
    }

    if (input.phone !== undefined) {
      const normalizedPhone = this.normalizePhone(input.phone);
      if (normalizedPhone) {
        const phoneExists = await this.phoneExists(normalizedPhone, user._id);
        if (phoneExists) {
          throw new ConflictException('El telefono ya esta registrado.');
        }
      }
      user.phone = input.phone.trim();
      user.phoneNormalized = normalizedPhone;
    }

    return user.save();
  }

  async findAdmin() {
    const admin = await this.userModel.findOne({ role: 'admin', status: 'active' }).exec();
    if (!admin) {
      throw new NotFoundException('No existe un psicologo administrador activo.');
    }
    return admin;
  }

  async saveRefreshToken(userId: string, refreshTokenHash?: string) {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash }).exec();
  }

  private normalizeEmail(email?: string) {
    return email?.trim().toLowerCase();
  }

  private normalizePhone(phone?: string) {
    if (!phone) {
      return undefined;
    }
    const trimmed = phone.trim();
    if (!/^\+?[\d\s().-]+$/.test(trimmed)) {
      throw new BadRequestException('El telefono debe contener solo numeros y tener 10 digitos.');
    }
    const digits = trimmed.replace(/\D/g, '');
    const localDigits = digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits;
    if (localDigits.length !== 10) {
      throw new BadRequestException('El telefono debe contener exactamente 10 digitos.');
    }
    return localDigits;
  }

  private async phoneExists(normalizedPhone: string, excludeUserId?: string | Types.ObjectId) {
    const excludeId = excludeUserId && Types.ObjectId.isValid(String(excludeUserId)) ? new Types.ObjectId(String(excludeUserId)) : excludeUserId;
    const excludeFilter = excludeId ? { _id: { $ne: excludeId } } : {};
    const directMatch = await this.userModel.exists({
      ...excludeFilter,
      phoneNormalized: { $in: [normalizedPhone, `52${normalizedPhone}`] },
    });
    if (directMatch) {
      return true;
    }

    const legacyMatches = await this.userModel
      .aggregate([
        { $match: { ...excludeFilter, phone: { $exists: true, $ne: null } } },
        {
          $addFields: {
            phoneNormalizedLegacy: {
              $replaceAll: {
                input: {
                  $replaceAll: {
                    input: {
                      $replaceAll: {
                        input: {
                          $replaceAll: {
                            input: {
                              $replaceAll: {
                                input: {
                                  $replaceAll: {
                                    input: '$phone',
                                    find: ' ',
                                    replacement: '',
                                  },
                                },
                                find: '-',
                                replacement: '',
                              },
                            },
                            find: '(',
                            replacement: '',
                          },
                        },
                        find: ')',
                        replacement: '',
                      },
                    },
                    find: '.',
                    replacement: '',
                  },
                },
                find: '+',
                replacement: '',
              },
            },
          },
        },
        { $match: { phoneNormalizedLegacy: { $in: [normalizedPhone, `52${normalizedPhone}`] } } },
        { $limit: 1 },
      ])
      .exec();

    return legacyMatches.length > 0;
  }
}
