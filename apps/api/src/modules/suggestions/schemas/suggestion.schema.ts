import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SuggestionStatus } from '@itzel/shared';

export type SuggestionDocument = HydratedDocument<Suggestion>;

@Schema({ timestamps: true })
export class Suggestion {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ required: true })
  message!: string;

  @Prop({ required: true, enum: ['new', 'reviewed', 'answered', 'closed'], default: 'new' })
  status!: SuggestionStatus;

  @Prop()
  adminResponse?: string;
}

export const SuggestionSchema = SchemaFactory.createForClass(Suggestion);
