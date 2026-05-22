import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '@itzel/shared';

export class CreateAppointmentDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show'])
  status!: AppointmentStatus;
}

export class RescheduleAppointmentDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}

export class CreateAdminAppointmentDto extends CreateAppointmentDto {}
