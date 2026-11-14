import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateCountDto {
  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  countedOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CountLineDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  counted!: string;
}

export class SubmitCountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  lines!: CountLineDto[];
}
