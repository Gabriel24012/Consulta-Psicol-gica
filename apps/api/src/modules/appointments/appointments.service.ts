import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { AppointmentStatus, AuthUser } from '@itzel/shared';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Appointment } from './schemas/appointment.schema';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    @InjectQueue('appointments') private readonly appointmentsQueue: Queue,
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  async create(patient: AuthUser, input: { startAt: string; endAt: string; reason?: string }) {
    const psychologist = await this.usersService.findAdmin();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
      throw new BadRequestException('Rango de fechas invalido.');
    }

    const available = await this.availabilityService.isSlotBookable(psychologist._id, startAt, endAt);
    if (!available) {
      throw new BadRequestException('Ese horario ya no esta disponible.');
    }

    const appointment = await this.createAppointmentOrConflict(patient, psychologist._id, startAt, endAt, input.reason);
    await this.patientsService.touchBooked(patient.sub);
    await this.notificationsService.create({
      userId: psychologist._id.toString(),
      type: 'appointment',
      message: `${patient.name} agendo una sesion para ${startAt.toLocaleString('es-MX')}.`,
      metadata: { appointmentId: appointment._id },
    });
    await this.scheduleReminder(appointment._id.toString(), startAt);
    return appointment;
  }

  async createForPatientByAdmin(patient: { sub: string; name: string }, input: { startAt: string; endAt: string; reason?: string }) {
    const psychologist = await this.usersService.findAdmin();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
      throw new BadRequestException('Rango de fechas invalido.');
    }

    const available = await this.availabilityService.isSlotBookable(psychologist._id, startAt, endAt);
    if (!available) {
      throw new BadRequestException('Ese horario ya no esta disponible.');
    }

    const appointment = await this.createAppointmentOrConflict(
      { sub: patient.sub, name: patient.name, email: '', role: 'patient' },
      psychologist._id,
      startAt,
      endAt,
      input.reason,
    );
    await this.patientsService.touchBooked(patient.sub);
    await this.notificationsService.create({
      userId: psychologist._id.toString(),
      type: 'appointment',
      message: `${patient.name} quedo agendado desde alta rapida para ${startAt.toLocaleString('es-MX')}.`,
      metadata: { appointmentId: appointment._id, source: 'admin_quick_intake' },
    });
    await this.scheduleReminder(appointment._id.toString(), startAt);
    return appointment;
  }

  listForUser(user: AuthUser) {
    const filter = user.role === 'admin' ? {} : { patientId: user.sub };
    return this.appointmentModel.find(filter).sort({ startAt: 1 }).populate('patientId', 'name email phone').exec();
  }

  listMine(user: AuthUser) {
    return this.appointmentModel.find({ patientId: user.sub }).sort({ startAt: 1 }).exec();
  }

  async deleteAll() {
    const allowDeleteAll = this.config.get<string>('ALLOW_APPOINTMENT_DELETE_ALL') === 'true';
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    if (isProduction && !allowDeleteAll) {
      throw new ForbiddenException('El borrado masivo de citas solo esta disponible cuando ALLOW_APPOINTMENT_DELETE_ALL=true.');
    }
    const result = await this.appointmentModel.deleteMany({}).exec();
    return { ok: true, deletedCount: result.deletedCount ?? 0 };
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    const update: Record<string, unknown> = { status };
    if (status === 'cancelled') {
      update.cancelledAt = new Date();
    }
    return this.appointmentModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async cancel(id: string, user: AuthUser) {
    const appointment = await this.appointmentModel.findById(id).exec();
    if (!appointment) {
      throw new NotFoundException('Cita no encontrada.');
    }
    if (user.role === 'patient' && appointment.patientId.toString() !== user.sub) {
      throw new ForbiddenException('No puedes cancelar una cita de otro paciente.');
    }
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    return appointment.save();
  }

  async reschedule(id: string, user: AuthUser, input: { startAt: string; endAt: string }) {
    const oldAppointment = await this.appointmentModel.findById(id).exec();
    if (!oldAppointment) {
      throw new NotFoundException('Cita no encontrada.');
    }
    if (user.role === 'patient' && oldAppointment.patientId.toString() !== user.sub) {
      throw new ForbiddenException('No puedes reprogramar una cita de otro paciente.');
    }
    const newAppointment = await this.create(
      { ...user, sub: oldAppointment.patientId.toString() },
      { ...input, reason: oldAppointment.reason },
    );
    newAppointment.rescheduledFrom = oldAppointment._id;
    await newAppointment.save();
    oldAppointment.status = 'cancelled';
    oldAppointment.cancelledAt = new Date();
    await oldAppointment.save();
    return newAppointment;
  }

  findById(id: string) {
    return this.appointmentModel.findById(id).populate('patientId', 'name phone').exec();
  }

  markReminderSent(id: string) {
    return this.appointmentModel.findByIdAndUpdate(id, { reminderSentAt: new Date() }).exec();
  }

  async sendAppointmentReminder(id: string) {
    const appointment = await this.appointmentModel
      .findById(id)
      .populate('patientId', 'name phone')
      .populate('psychologistId', 'name')
      .exec();

    if (!appointment) {
      return { ok: false, skipped: 'not_found' };
    }
    if (appointment.reminderSentAt) {
      return { ok: true, skipped: 'already_sent' };
    }
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return { ok: true, skipped: `status_${appointment.status}` };
    }
    if (appointment.startAt.getTime() <= Date.now()) {
      return { ok: true, skipped: 'appointment_started' };
    }

    const patient = appointment.patientId as unknown as { _id?: unknown; name?: string; phone?: string };
    const psychologist = appointment.psychologistId as unknown as { name?: string };
    const patientPhone = patient.phone?.trim();
    if (!patientPhone) {
      const admin = await this.usersService.findAdmin();
      await this.notificationsService.create({
        userId: admin._id.toString(),
        type: 'appointment',
        message: `No se pudo enviar recordatorio de cita a ${patient.name ?? 'Paciente'} porque no tiene telefono registrado.`,
        metadata: { appointmentId: appointment._id.toString(), channel: 'whatsapp', skipped: 'missing_phone' },
      });
      return { ok: false, skipped: 'missing_phone' };
    }

    const reminder = this.buildReminderMessage({
      patientName: patient.name ?? 'Paciente',
      psychologistName: psychologist.name ?? 'tu psicologo',
      startAt: appointment.startAt,
      endAt: appointment.endAt,
    });

    const result = await this.whatsappService.sendAppointmentReminder(patientPhone, reminder);
    await this.markReminderSent(id);
    await this.notificationsService.create({
      userId: patient._id?.toString() ?? appointment.patientId.toString(),
      type: 'appointment',
      message: 'Te enviamos un recordatorio por WhatsApp para confirmar tu asistencia a la sesion.',
      metadata: { appointmentId: appointment._id.toString(), channel: 'whatsapp' },
    });
    return { ok: true, result };
  }

  private buildReminderMessage(input: { patientName: string; psychologistName: string; startAt: Date; endAt: Date }) {
    const timeZone = this.config.get<string>('APPOINTMENT_TIMEZONE', 'America/Mexico_City');
    const location = this.config.get<string>('APPOINTMENT_LOCATION', 'ubicacion del consultorio por confirmar');
    const dateLabel = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(input.startAt);
    const timeFormatter = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    });

    const timeLabel = `${timeFormatter.format(input.startAt)} - ${timeFormatter.format(input.endAt)}`;
    const previewBody = [
      `Hola ${input.patientName}.`,
      `Te recordamos tu cita de psicologia con ${input.psychologistName}.`,
      `Fecha: ${dateLabel}.`,
      `Hora: ${timeLabel}.`,
      `Ubicacion: ${location}.`,
      'Por favor confirma tu asistencia respondiendo a este mensaje.',
      'Si no puedes asistir, avisanos lo antes posible para que alguien mas pueda ocupar el lugar.',
    ].join('\n');

    return {
      patientName: input.patientName,
      psychologistName: input.psychologistName,
      date: dateLabel,
      time: timeLabel,
      location,
      previewBody,
    };
  }

  private async createAppointmentOrConflict(
    patient: AuthUser,
    psychologistId: Types.ObjectId,
    startAt: Date,
    endAt: Date,
    reason?: string,
  ) {
    try {
      return await this.appointmentModel.create({
        patientId: patient.sub,
        psychologistId,
        startAt,
        endAt,
        reason,
        status: 'confirmed',
        patientConfirmation: 'yes',
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Ese horario acaba de ser reservado. Elige otro horario disponible.');
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
  }

  private async scheduleReminder(appointmentId: string, startAt: Date) {
    try {
      await this.appointmentsQueue.add(
        'appointment-reminder',
        { appointmentId },
        {
          delay: Math.max(startAt.getTime() - Date.now() - 24 * 60 * 60 * 1000, 0),
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          jobId: `appointment-reminder-${appointmentId}`,
          removeOnComplete: true,
        },
      );
    } catch (error) {
      this.logger.error(`No se pudo programar recordatorio para cita ${appointmentId}`, error);
    }
  }
}
