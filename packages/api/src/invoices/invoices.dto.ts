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
  Matches,
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

export class ManualInvoiceLineDto {
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @IsInt()
  @Min(1)
  @Max(999999)
  quantity!: number;

  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  unitPrice!: string;
}

export class CreateManualInvoiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  airlineName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ManualInvoiceLineDto)
  lines!: ManualInvoiceLineDto[];
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
