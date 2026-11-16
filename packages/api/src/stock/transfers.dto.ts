import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TransferLineDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  quantity!: string;
}

export class CreateTransferDto {
  @IsString()
  @MinLength(1)
  fromLocationId!: string;

  @IsString()
  @MinLength(1)
  toLocationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  sentOn!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];
}

export class ReceiveTransferDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  receivedOn!: string;
}
