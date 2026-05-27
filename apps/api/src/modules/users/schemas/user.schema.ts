import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole, UserStatus } from '@itzel/shared';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  phoneNormalized?: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ required: true, enum: ['admin', 'patient'], default: 'patient' })
  role!: UserRole;

  @Prop({ required: true, enum: ['active', 'inactive', 'blocked', 'incomplete'], default: 'active' })
  status!: UserStatus;

  @Prop()
  privacyConsentAcceptedAt?: Date;

  @Prop({ select: false })
  refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

UserSchema.index(
  { phoneNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNormalized: { $type: 'string' } },
  },
);
