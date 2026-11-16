import { LOCATION_TYPES } from '@knazawy/shared';
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(LOCATION_TYPES)
  type!: (typeof LOCATION_TYPES)[number];

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
