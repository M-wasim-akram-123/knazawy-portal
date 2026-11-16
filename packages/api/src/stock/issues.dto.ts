import { STOCK_ISSUE_REASONS } from '@knazawy/shared';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IssueLineDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  quantity!: string;
}

export class CreateIssueDto {
  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  issuedOn!: string;

  @IsIn(STOCK_ISSUE_REASONS)
  reason!: (typeof STOCK_ISSUE_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IssueLineDto)
  lines!: IssueLineDto[];
}
