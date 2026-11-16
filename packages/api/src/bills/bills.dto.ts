import { IsOptional, IsString, MinLength } from 'class-validator';

export class PostBillDto {
  @IsString()
  @MinLength(1)
  supplierId!: string;

  @IsString()
  @MinLength(1)
  billNumber!: string;

  @IsString()
  billedOn!: string;

  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  billTotal!: string;

  @IsOptional()
  @IsString()
  tax?: string;

  @IsOptional()
  @IsString()
  discount?: string;

  @IsString()
  lines!: string;
}
