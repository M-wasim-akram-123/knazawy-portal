import { BASE_UNITS, STORAGE_TYPES } from '@knazawy/shared';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category!: string;

  @IsIn(BASE_UNITS)
  baseUnit!: (typeof BASE_UNITS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  purchaseUnit!: string;

  @IsString()
  @MinLength(1)
  conversionToBase!: string;

  @IsString()
  @MinLength(1)
  reorderLevel!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(36500)
  shelfLifeDays!: number;

  @IsIn(STORAGE_TYPES)
  storageType!: (typeof STORAGE_TYPES)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  supplierIds?: string[];
}

export class UpdateItemDto extends PartialType(CreateItemDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
