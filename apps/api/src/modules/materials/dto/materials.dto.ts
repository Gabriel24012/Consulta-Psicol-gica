import { ArrayNotEmpty, IsArray, IsBoolean, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMaterialSectionDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;
}

export class UpdateMaterialSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MaterialPatientsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  patientIds!: string[];
}
