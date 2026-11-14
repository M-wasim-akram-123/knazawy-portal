import { DELIVERY_POINTS, type DeliveryPoint } from '@knazawy/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RequestLineDto {
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class ServiceRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  flightNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  route!: string;

  /** YYYY-MM-DD from the date field. */
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  serviceDate!: string;

  @IsString()
  @MaxLength(5)
  deliveryTime!: string;

  @IsIn(DELIVERY_POINTS)
  deliveryPoint!: DeliveryPoint;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveryDetail?: string;

  @IsInt()
  @Min(0)
  @Max(999)
  adults!: number;

  @IsInt()
  @Min(0)
  @Max(999)
  children!: number;

  @IsInt()
  @Min(0)
  @Max(999)
  infants!: number;

  @IsInt()
  @Min(0)
  @Max(999)
  crew!: number;

  @IsInt()
  @Min(0)
  @Max(999)
  specialDiets!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialDietNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  /** A draft can be saved with no menu items yet. Sending it needs at least one. */
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RequestLineDto)
  lines!: RequestLineDto[];
}

export class RejectServiceRequestDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}
