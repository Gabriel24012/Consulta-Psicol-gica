import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PatientStatus } from '@itzel/shared';

export type PatientProfileDocument = HydratedDocument<PatientProfile>;

@Schema({ timestamps: true })
export class PatientProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop()
  birthDate?: Date;

  @Prop({
    required: true,
    enum: ['new', 'active', 'inactive', 'follow_up', 'discharged'],
    default: 'new',
    index: true,
  })
  patientStatus!: PatientStatus;

  @Prop()
  administrativeNotes?: string;

  @Prop()
  clinicalPrivateNotesEncrypted?: string;

  @Prop()
  lastSessionAt?: Date;

  @Prop()
  lastBookedAt?: Date;

  @Prop({ default: 0 })
  totalSessions!: number;

  @Prop()
  remainingSessions?: number;

  @Prop({
    type: {
      name: String,
      phone: String,
    },
  })
  emergencyContact?: { name: string; phone: string };
}

export const PatientProfileSchema = SchemaFactory.createForClass(PatientProfile);
