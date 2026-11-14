import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class OpenDisputeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  invoiceId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  roomInvoiceId?: string;

  @IsString()
  @MaxLength(300)
  reason!: string;
}

export class DecideDisputeDto {
  @IsString()
  @MaxLength(300)
  resolution!: string;
}
