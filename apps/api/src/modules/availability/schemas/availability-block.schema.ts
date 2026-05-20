import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AvailabilityBlockDocument = HydratedDocument<AvailabilityBlock>;

@Schema({ timestamps: true })
export class AvailabilityBlock {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  psychologistId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  startAt!: Date;

  @Prop({ required: true, index: true })
  endAt!: Date;

  @Prop()
  reason?: string;

  @Prop({ required: true, enum: ['vacation', 'personal', 'event', 'other'], default: 'other' })
  type!: string;
}

export const AvailabilityBlockSchema = SchemaFactory.createForClass(AvailabilityBlock);
