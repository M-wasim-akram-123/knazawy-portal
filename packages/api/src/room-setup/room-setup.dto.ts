import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateFloorDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class UpdateFloorDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateRoomTypeDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateChargeDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(16)
  amountPerNight!: string;
}

export class UpdateChargeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  amountPerNight?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateHotelRoomDto {
  @IsString()
  floorId!: string;

  @IsString()
  roomTypeId!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  /** How many guests the room sleeps. Two when left out. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  capacity?: number;
}

export class UpdateHotelRoomDto {
  @IsOptional()
  @IsString()
  floorId?: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
