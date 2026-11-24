import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@knazawy/shared';
import type { Role } from '@knazawy/shared';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const ROLES = [
  'AIRLINE_REQUESTER',
  'AIRLINE_FINANCE',
  'OPERATIONS_MANAGER',
  'STOREKEEPER',
  'HEAD_CHEF',
  'CHEF',
  'FINANCE_OFFICER',
  'ADMINISTRATOR',
] as const;

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsIn(ROLES)
  role!: Role;

  /** Leave out for a Karam staff account; give an airline's id for one of its people. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  organisationId?: string;

  /** The branch a staff member works in. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchId?: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchId?: string;
}

export class SetPasswordDto {
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}
