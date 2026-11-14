import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ReceiptLineDto {
  @IsString()
  @MinLength(1)
  purchaseLineId!: string;

  @IsString()
  @MinLength(1)
  quantity!: string;
}

export class CreateReceiptDto {
  @IsString()
  @MinLength(1)
  purchaseId!: string;

  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  receivedOn!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines!: ReceiptLineDto[];
}
