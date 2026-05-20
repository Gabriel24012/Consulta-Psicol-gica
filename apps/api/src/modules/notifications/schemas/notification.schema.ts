import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationType } from '@itzel/shared';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['appointment', 'message', 'suggestion', 'crm', 'system'] })
  type!: NotificationType;

  @Prop({ required: true })
  message!: string;

  @Prop()
  readAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
