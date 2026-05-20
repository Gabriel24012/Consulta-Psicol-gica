import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { Appointment } from '../appointments/schemas/appointment.schema';
import { PatientProfile } from '../patients/schemas/patient-profile.schema';
import { UsersService } from '../users/users.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(PatientProfile.name) private readonly profileModel: Model<PatientProfile>,
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsappService,
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

  async inactivePatients(days = 30) {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const profiles = await this.profileModel
      .find({ $or: [{ lastBookedAt: { $lt: threshold } }, { lastBookedAt: { $exists: false } }] })
      .populate('userId', 'name email phone')
      .sort({ lastBookedAt: 1 })
      .exec();
    const seenUserIds = new Set<string>();
    const uniqueProfiles = profiles.filter((profile) => {
      const user = profile.userId as unknown as { _id?: unknown };
      const userId = user?._id?.toString() ?? profile.userId?.toString();
      if (!userId || seenUserIds.has(userId)) {
        return false;
      }
      seenUserIds.add(userId);
      return true;
    });

    const userIds = uniqueProfiles.map((profile) => {
      const user = profile.userId as unknown as { _id?: unknown };
      return user?._id ?? profile.userId;
    });
    const activeAppointments = await this.appointmentModel
      .find({
        patientId: { $in: userIds },
        endAt: { $gte: new Date() },
        status: { $nin: ['cancelled', 'completed', 'no_show'] },
      })
      .select('patientId')
      .lean()
      .exec();
    const scheduledUserIds = new Set(activeAppointments.map((appointment) => appointment.patientId.toString()));

    return uniqueProfiles.filter((profile) => {
      const user = profile.userId as unknown as { _id?: unknown };
      const userId = user?._id?.toString() ?? profile.userId?.toString();
      return !scheduledUserIds.has(userId);
    });
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

  async sendReminder(patientId: string) {
    const patient = await this.usersService.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      throw new NotFoundException('Paciente no encontrado.');
    }
    if (!patient.phone) {
      throw new BadRequestException('El paciente no tiene teléfono registrado para enviar recordatorio.');
    }

    const message = [
      `Hola ${patient.name}, esperamos que estés muy bien.`,
      'Te escribimos desde el portal de consulta psicológica para recordarte que puedes agendar tu próxima sesión cuando lo necesites.',
    ].join(' ');

    const whatsapp = await this.whatsappService.sendText(patient.phone, message);
    const admin = await this.usersService.findAdmin();
    await this.notificationsService.create({
      userId: patient._id.toString(),
      type: 'crm',
      message: 'Te recordamos que puedes agendar tu proxima sesion desde el portal cuando lo necesites.',
      metadata: { patientId, channel: 'portal', source: 'admin_reminder' },
    });
    await this.notificationsService.create({
      userId: admin._id.toString(),
      type: 'crm',
      message: `Recordatorio enviado a ${patient.name}.`,
      metadata: { patientId, channel: 'whatsapp', portalNotification: true },
    });
    await this.profileModel.findOneAndUpdate({ userId: patientId }, { patientStatus: 'follow_up' }, { new: true }).exec();
    return { ok: true, channel: 'whatsapp', result: whatsapp };
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
