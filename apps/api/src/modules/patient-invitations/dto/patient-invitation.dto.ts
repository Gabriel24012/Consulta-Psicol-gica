import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class QuickAppointmentDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePatientInvitationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  name!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuickAppointmentDto)
  appointment?: QuickAppointmentDto;
}

export class CompletePatientInvitationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsBoolean()
  privacyConsentAccepted!: boolean;
}
