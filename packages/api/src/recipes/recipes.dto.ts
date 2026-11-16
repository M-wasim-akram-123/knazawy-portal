import { RECIPE_KINDS } from '@knazawy/shared';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RecipeLineDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  quantity!: string;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(RECIPE_KINDS)
  kind!: (typeof RECIPE_KINDS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  portions!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  wastagePercent!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines!: RecipeLineDto[];
}

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
