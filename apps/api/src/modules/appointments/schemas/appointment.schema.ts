import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AppointmentStatus, PatientConfirmation } from '@itzel/shared';

export type AppointmentDocument = HydratedDocument<Appointment>;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  psychologistId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  startAt!: Date;

  @Prop({ required: true })
  endAt!: Date;

  @Prop({
    required: true,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'pending',
    index: true,
  })
  status!: AppointmentStatus;

  @Prop()
  reason?: string;

  @Prop({ required: true, enum: ['pending', 'yes', 'no'], default: 'pending' })
  patientConfirmation!: PatientConfirmation;

  @Prop()
  reminderSentAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Appointment' })
  rescheduledFrom?: Types.ObjectId;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index(
  { psychologistId: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'cancelled' } },
  },
);
