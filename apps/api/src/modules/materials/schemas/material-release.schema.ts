import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MaterialReleaseDocument = HydratedDocument<MaterialRelease>;

@Schema({ timestamps: true })
export class MaterialRelease {
  @Prop({ type: Types.ObjectId, ref: 'MaterialSection', required: true, index: true })
  sectionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  releasedBy!: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  releasedAt!: Date;
}

export const MaterialReleaseSchema = SchemaFactory.createForClass(MaterialRelease);
MaterialReleaseSchema.index({ sectionId: 1, patientId: 1 }, { unique: true });
