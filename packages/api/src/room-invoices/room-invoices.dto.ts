import { IsString, MaxLength, MinLength } from 'class-validator';

export class RaiseRoomInvoiceDto {
  @IsString()
  @MinLength(1)
  roomRequestId!: string;
}

export class CreditRoomInvoiceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
