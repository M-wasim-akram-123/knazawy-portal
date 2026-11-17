import { AIRLINE_ROLES } from '@knazawy/shared';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAirlineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(12)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxNumber?: string;
}

export class UpdateAirlineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxNumber?: string;
}

export class CreateAirlineUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsIn(AIRLINE_ROLES)
  role!: (typeof AIRLINE_ROLES)[number];

  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password!: string;
}

export class UpdateAirlineUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsIn(AIRLINE_ROLES)
  role?: (typeof AIRLINE_ROLES)[number];

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password?: string;
}

export class AirlineTermsDto {
  @IsInt()
  @Min(0)
  @Max(180)
  paymentTermsDays!: number;

  @IsString()
  @Matches(/^\d{1,3}(?:\.\d{1,2})?$/)
  discountPercent!: string;
}
