import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @MinLength(1)
  requestId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreditLineDto {
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @IsInt()
  @Min(1)
  @Max(9999)
  quantity!: number;
}

export class CreditInvoiceDto {
  @IsString()
  @MaxLength(300)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreditLineDto)
  lines!: CreditLineDto[];
}
