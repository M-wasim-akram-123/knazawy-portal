import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(12)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class UseBranchDto {
  @IsString()
  @MinLength(1)
  branchId!: string;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
