import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PatientStatus } from '@itzel/shared';

export class UpdatePatientStatusDto {
  @IsEnum(['new', 'active', 'inactive', 'follow_up', 'discharged'])
  patientStatus!: PatientStatus;
}

export class UpdatePatientPackageDto {
  @IsInt()
  @Min(0)
  remainingSessions!: number;
}

export class CreatePatientNoteDto {
  @IsOptional()
  @IsString()
  administrativeNotes?: string;

  @IsOptional()
  @IsString()
  clinicalPrivateNotes?: string;
}
