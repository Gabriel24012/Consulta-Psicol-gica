import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PatientInvitationDocument = HydratedDocument<PatientInvitation>;

@Schema({ timestamps: true })
export class PatientInvitation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  @Prop()
  usedAt?: Date;
}

export const PatientInvitationSchema = SchemaFactory.createForClass(PatientInvitation);
