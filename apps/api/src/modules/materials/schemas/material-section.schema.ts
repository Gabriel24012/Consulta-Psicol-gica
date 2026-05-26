import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MaterialSectionDocument = HydratedDocument<MaterialSection>;

@Schema({ timestamps: true })
export class MaterialSection {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const MaterialSectionSchema = SchemaFactory.createForClass(MaterialSection);
