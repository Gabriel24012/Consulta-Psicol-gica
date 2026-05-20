import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAvailabilityRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  sessionDurationMinutes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferMinutes!: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class CreateAvailabilityBlockDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsEnum(['vacation', 'personal', 'event', 'other'])
  type!: string;
}
