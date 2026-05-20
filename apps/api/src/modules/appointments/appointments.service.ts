import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { AppointmentStatus, AuthUser } from '@itzel/shared';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { Appointment } from './schemas/appointment.schema';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    @InjectQueue('appointments') private readonly appointmentsQueue: Queue,
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(patient: AuthUser, input: { startAt: string; endAt: string; reason?: string }) {
    const psychologist = await this.usersService.findAdmin();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (startAt >= endAt) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora final.');
    }

    const available = await this.availabilityService.isSlotAvailable(psychologist._id, startAt, endAt);
    if (!available) {
      throw new BadRequestException('Ese horario ya no está disponible.');
    }

    const appointment = await this.appointmentModel.create({
      patientId: patient.sub,
      psychologistId: psychologist._id,
      startAt,
      endAt,
      reason: input.reason,
      status: 'confirmed',
      patientConfirmation: 'yes',
    });
    await this.patientsService.touchBooked(patient.sub);
    await this.notificationsService.create({
      userId: psychologist._id.toString(),
      type: 'appointment',
      message: `${patient.name} agendó una sesión para ${startAt.toLocaleString('es-MX')}.`,
      metadata: { appointmentId: appointment._id },
    });
    await this.appointmentsQueue.add(
      'appointment-reminder',
      { appointmentId: appointment._id.toString() },
      { delay: Math.max(startAt.getTime() - Date.now() - 24 * 60 * 60 * 1000, 0) },
    );
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
    await this.cancel(id, user);
    const newAppointment = await this.create(
      { ...user, sub: oldAppointment.patientId.toString() },
      { ...input, reason: oldAppointment.reason },
    );
    newAppointment.rescheduledFrom = oldAppointment._id;
    return newAppointment.save();
  }

  findById(id: string) {
    return this.appointmentModel.findById(id).populate('patientId', 'name phone').exec();
  }

  markReminderSent(id: string) {
    return this.appointmentModel.findByIdAndUpdate(id, { reminderSentAt: new Date() }).exec();
  }
}
