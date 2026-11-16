import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RateCardLineDto {
  @IsString()
  @MinLength(1)
  recipeId!: string;

  /** PKR, up to 2 decimal places. */
  @IsString()
  @MaxLength(13)
  unitPrice!: string;

  @IsInt()
  @Min(0)
  @Max(9999)
  minimumQuantity!: number;
}

export class RateCardDto {
  @IsString()
  @MinLength(1)
  airlineId!: string;

  /** YYYY-MM-DD. */
  @IsString()
  @Length(10, 10)
  validFrom!: string;

  /** YYYY-MM-DD. Leave out for a card with no end date. */
  @IsOptional()
  @IsString()
  @Length(10, 10)
  validTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RateCardLineDto)
  lines!: RateCardLineDto[];
}

export class EndRateCardDto {
  /** YYYY-MM-DD, the last day the card applies. */
  @IsString()
  @Length(10, 10)
  validTo!: string;
}
