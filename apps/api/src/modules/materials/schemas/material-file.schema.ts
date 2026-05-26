import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MaterialFileDocument = HydratedDocument<MaterialFile>;

@Schema({ timestamps: true })
export class MaterialFile {
  @Prop({ type: Types.ObjectId, ref: 'MaterialSection', required: true, index: true })
  sectionId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  originalName!: string;

  @Prop({ required: true, trim: true })
  storedName!: string;

  @Prop({ required: true, trim: true })
  mimeType!: string;

  @Prop({ required: true })
  size!: number;

  @Prop({ required: true, trim: true })
  path!: string;
}

export const MaterialFileSchema = SchemaFactory.createForClass(MaterialFile);
