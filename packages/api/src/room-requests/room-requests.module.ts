import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { RoomRequestsController } from './room-requests.controller';
import { RoomRequestsService } from './room-requests.service';

@Module({
  imports: [AuthModule],
  controllers: [RoomRequestsController],
  providers: [RoomRequestsService],
})
export class RoomRequestsModule {}
