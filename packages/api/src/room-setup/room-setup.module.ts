import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import {
  HotelRoomsController,
  RoomFloorsController,
  RoomTypesController,
} from './room-setup.controller';
import { RoomSetupService } from './room-setup.service';

@Module({
  imports: [AuthModule],
  controllers: [RoomFloorsController, RoomTypesController, HotelRoomsController],
  providers: [RoomSetupService],
})
export class RoomSetupModule {}
