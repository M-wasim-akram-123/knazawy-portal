import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class PurchaseLineDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @MinLength(1)
  quantity!: string;

  @IsString()
  @MinLength(1)
  unitPrice!: string;
}

export class CreatePurchaseDto {
  @IsString()
  @MinLength(1)
  supplierId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  orderedOn!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}
