import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SuggestionStatus } from '@itzel/shared';

export class CreateSuggestionDto {
  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class UpdateSuggestionStatusDto {
  @IsEnum(['new', 'reviewed', 'answered', 'closed'])
  status!: SuggestionStatus;
}

export class RespondSuggestionDto {
  @IsString()
  @MaxLength(2000)
  adminResponse!: string;

  @IsOptional()
  @IsEnum(['new', 'reviewed', 'answered', 'closed'])
  status?: SuggestionStatus;
}
