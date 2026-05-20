import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { PatientProfile } from '../patients/schemas/patient-profile.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(PatientProfile.name) private readonly profileModel: Model<PatientProfile>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async summary() {
    const [totalPatients, activePatients, followUpPatients, inactivePatients] = await Promise.all([
      this.profileModel.countDocuments(),
      this.profileModel.countDocuments({ patientStatus: 'active' }),
      this.profileModel.countDocuments({ patientStatus: 'follow_up' }),
      this.profileModel.countDocuments({ patientStatus: 'inactive' }),
    ]);
    return { totalPatients, activePatients, followUpPatients, inactivePatients };
  }

  inactivePatients(days = 30) {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.profileModel
      .find({ $or: [{ lastBookedAt: { $lt: threshold } }, { lastBookedAt: { $exists: false } }] })
      .populate('userId', 'name email phone')
      .sort({ lastBookedAt: 1 })
      .exec();
  }

  async followUp(patientId: string) {
    const profile = await this.profileModel
      .findOneAndUpdate({ userId: patientId }, { patientStatus: 'follow_up' }, { new: true })
      .exec();
    const admin = await this.usersService.findAdmin();
    await this.notificationsService.create({
      userId: admin._id.toString(),
      type: 'crm',
      message: 'Paciente marcado para seguimiento.',
      metadata: { patientId },
    });
    return profile;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dailyFollowUpScan() {
    const admin = await this.usersService.findAdmin().catch(() => null);
    if (!admin) {
      return;
    }
    const inactive = await this.inactivePatients(30);
    if (inactive.length > 0) {
      await this.notificationsService.create({
        userId: admin._id.toString(),
        type: 'crm',
        message: `Hay ${inactive.length} pacientes sin agendar recientemente.`,
      });
    }
  }
}
