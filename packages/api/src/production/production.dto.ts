import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProductionDto {
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  producedOn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  plannedPortions!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  actualPortions!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
