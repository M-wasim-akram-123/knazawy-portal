import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { RoomBoardController } from './room-board.controller';
import { RoomBoardService } from './room-board.service';

@Module({
  imports: [AuthModule],
  controllers: [RoomBoardController],
  providers: [RoomBoardService],
})
export class RoomBoardModule {}
