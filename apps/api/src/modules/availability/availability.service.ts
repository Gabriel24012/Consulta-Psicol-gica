import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AvailabilitySlot } from '@itzel/shared';
import { Appointment } from '../appointments/schemas/appointment.schema';
import { UsersService } from '../users/users.service';
import { AvailabilityBlock } from './schemas/availability-block.schema';
import { AvailabilityRule } from './schemas/availability-rule.schema';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(AvailabilityRule.name) private readonly ruleModel: Model<AvailabilityRule>,
    @InjectModel(AvailabilityBlock.name) private readonly blockModel: Model<AvailabilityBlock>,
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    private readonly usersService: UsersService,
  ) {}

  async listSlots(fromRaw: string, toRaw: string): Promise<AvailabilitySlot[]> {
    const psychologist = await this.usersService.findAdmin();
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new BadRequestException('Rango de fechas inválido.');
    }

    const rules = await this.ruleModel.find({ psychologistId: psychologist._id, active: true }).lean().exec();
    const blocks = await this.blockModel
      .find({ psychologistId: psychologist._id, startAt: { $lt: to }, endAt: { $gt: from } })
      .lean()
      .exec();
    const appointments = await this.appointmentModel
      .find({
        psychologistId: psychologist._id,
        status: { $ne: 'cancelled' },
        startAt: { $lt: to },
        endAt: { $gt: from },
      })
      .lean()
      .exec();

    const slots: AvailabilitySlot[] = [];
    for (const day of this.daysBetween(from, to)) {
      const dayRules = rules.filter((rule) => rule.weekday === day.getDay());
      for (const rule of dayRules) {
        slots.push(...this.slotsForRule(day, rule));
      }
    }

    const availableSlots = slots.filter((slot) => {
      const start = new Date(slot.startAt);
      const end = new Date(slot.endAt);
      return (
        start >= from &&
        end <= to &&
        !blocks.some((block) => start < block.endAt && end > block.startAt) &&
        !appointments.some((appointment) => start < appointment.endAt && end > appointment.startAt)
      );
    });

    return Array.from(new Map(availableSlots.map((slot) => [`${slot.startAt}-${slot.endAt}`, slot])).values());
  }

  async isSlotAvailable(psychologistId: Types.ObjectId, startAt: Date, endAt: Date) {
    const overlap = await this.appointmentModel.exists({
      psychologistId,
      status: { $ne: 'cancelled' },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });
    const blocked = await this.blockModel.exists({
      psychologistId,
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });
    return !overlap && !blocked;
  }

  async listRules() {
    const psychologist = await this.usersService.findAdmin();
    return this.ruleModel.find({ psychologistId: psychologist._id }).sort({ weekday: 1, startTime: 1 }).exec();
  }

  async createRule(input: Partial<AvailabilityRule>) {
    const psychologist = await this.usersService.findAdmin();
    this.validateRule(input);
    const duplicated = await this.ruleModel.exists({
      psychologistId: psychologist._id,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      sessionDurationMinutes: input.sessionDurationMinutes,
      bufferMinutes: input.bufferMinutes,
      active: true,
    });
    if (duplicated) {
      throw new BadRequestException('Ese bloque de disponibilidad ya existe para este día.');
    }
    return this.ruleModel.create({ ...input, psychologistId: psychologist._id });
  }

  updateRule(id: string, input: Partial<AvailabilityRule>) {
    this.validateRule(input);
    return this.ruleModel.findByIdAndUpdate(id, input, { new: true }).exec();
  }

  deleteRule(id: string) {
    return this.ruleModel.findByIdAndDelete(id).exec();
  }

  async createBlock(input: { startAt: string; endAt: string; reason?: string; type: string }) {
    const psychologist = await this.usersService.findAdmin();
    return this.blockModel.create({
      ...input,
      psychologistId: psychologist._id,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
    });
  }

  deleteBlock(id: string) {
    return this.blockModel.findByIdAndDelete(id).exec();
  }

  private *daysBetween(from: Date, to: Date) {
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    while (current < to) {
      yield new Date(current);
      current.setDate(current.getDate() + 1);
    }
  }

  private slotsForRule(day: Date, rule: AvailabilityRule): AvailabilitySlot[] {
    const [startHour, startMinute] = rule.startTime.split(':').map(Number);
    const [endHour, endMinute] = rule.endTime.split(':').map(Number);
    const cursor = new Date(day);
    cursor.setHours(startHour, startMinute, 0, 0);
    const boundary = new Date(day);
    boundary.setHours(endHour, endMinute, 0, 0);

    const slots: AvailabilitySlot[] = [];
    const step = rule.sessionDurationMinutes + rule.bufferMinutes;
    while (cursor.getTime() + rule.sessionDurationMinutes * 60_000 <= boundary.getTime()) {
      const startAt = new Date(cursor);
      const endAt = new Date(cursor.getTime() + rule.sessionDurationMinutes * 60_000);
      slots.push({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
      cursor.setMinutes(cursor.getMinutes() + step);
    }
    return slots;
  }

  private validateRule(input: Partial<AvailabilityRule>) {
    if (!input.startTime || !input.endTime || !input.sessionDurationMinutes) {
      throw new BadRequestException('Completa día, hora de inicio, hora de cierre y duración de sesión.');
    }

    const startMinutes = this.timeToMinutes(input.startTime);
    const endMinutes = this.timeToMinutes(input.endTime);
    if (startMinutes >= endMinutes) {
      throw new BadRequestException('La hora de cierre debe ser posterior a la hora de inicio.');
    }

    if (endMinutes - startMinutes < input.sessionDurationMinutes) {
      throw new BadRequestException('El bloque configurado no alcanza para una sesión completa.');
    }
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      throw new BadRequestException('Formato de hora inválido.');
    }
    return hours * 60 + minutes;
  }
}
