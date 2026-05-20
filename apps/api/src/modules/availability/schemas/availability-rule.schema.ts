import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AvailabilityRuleDocument = HydratedDocument<AvailabilityRule>;

@Schema({ timestamps: true })
export class AvailabilityRule {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  psychologistId!: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 6 })
  weekday!: number;

  @Prop({ required: true })
  startTime!: string;

  @Prop({ required: true })
  endTime!: string;

  @Prop({ required: true, default: 50 })
  sessionDurationMinutes!: number;

  @Prop({ required: true, default: 10 })
  bufferMinutes!: number;

  @Prop({ default: true })
  active!: boolean;
}

export const AvailabilityRuleSchema = SchemaFactory.createForClass(AvailabilityRule);
