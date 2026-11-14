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
  ValidateNested,
} from 'class-validator';

export class DeliveryQuantityDto {
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @IsInt()
  @Min(0)
  @Max(999)
  quantity!: number;
}

export class StartDeliveryDto {
  @IsString()
  @MinLength(1)
  requestId!: string;
}

export class DispatchDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vehicleNote?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeliveryQuantityDto)
  lines!: DeliveryQuantityDto[];
}

export class RecordDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  receivedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeliveryQuantityDto)
  lines!: DeliveryQuantityDto[];
}
