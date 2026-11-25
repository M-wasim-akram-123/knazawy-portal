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

export class RoomRequestLineDto {
  @IsString()
  @MinLength(1)
  roomTypeId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  rooms!: number;
}

export class RoomRequestDto {
  /** YYYY-MM-DD from the date field. */
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  checkIn!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10)
  checkOut!: string;

  @IsString()
  @MinLength(1)
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  party?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => RoomRequestLineDto)
  lines!: RoomRequestLineDto[];
}

export class CheckInRoomDto {
  /** The room a guest moves into. */
  @IsString()
  @MinLength(1)
  hotelRoomId!: string;

  @IsInt()
  @Min(0)
  @Max(20)
  male!: number;

  @IsInt()
  @Min(0)
  @Max(20)
  female!: number;

  @IsInt()
  @Min(0)
  @Max(20)
  children!: number;

  /** HH:MM in Karachi. Noon when left out. */
  @IsOptional()
  @IsString()
  @MaxLength(5)
  checkOutTime?: string;
}

export class CheckInRoomsDto {
  /** One entry per room a guest moves into. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(99)
  @ValidateNested({ each: true })
  @Type(() => CheckInRoomDto)
  rooms!: CheckInRoomDto[];
}

export class ReserveRoomsDto {
  /** Karam's room ids to set aside for the stay. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(99)
  @IsString({ each: true })
  hotelRoomIds!: string[];
}

export class RejectRoomRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
