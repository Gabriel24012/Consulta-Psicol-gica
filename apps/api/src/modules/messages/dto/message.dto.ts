import { IsMongoId, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  patientId!: string;

  @IsString()
  @MaxLength(2000)
  content!: string;
}
