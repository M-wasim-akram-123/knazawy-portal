import { IsString, MaxLength, MinLength } from 'class-validator';

export class OpenDisputeDto {
  @IsString()
  @MinLength(1)
  invoiceId!: string;

  @IsString()
  @MaxLength(300)
  reason!: string;
}

export class DecideDisputeDto {
  @IsString()
  @MaxLength(300)
  resolution!: string;
}
