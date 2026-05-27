import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PatientStatus } from '@itzel/shared';

export class UpdatePatientStatusDto {
  @IsEnum(['new', 'active', 'inactive', 'follow_up', 'discharged'])
  patientStatus!: PatientStatus;
}

export class UpdatePatientPackageDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalSessions!: number;
}

export class UpdatePatientContactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreatePatientNoteDto {
  @IsOptional()
  @IsString()
  administrativeNotes?: string;

  @IsOptional()
  @IsString()
  clinicalPrivateNotes?: string;
}
