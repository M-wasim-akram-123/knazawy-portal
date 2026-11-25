import type { Actor, RoomBoardRecord } from '@knazawy/shared';
import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { RoomBoardService } from './room-board.service';

@ApiTags('Room board')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('room-board')
export class RoomBoardController {
  constructor(private readonly board: RoomBoardService) {}

  /** `from` is YYYY-MM-DD and `days` is 7, 14, or 30. Both are optional. */
  @Get()
  get(
    @CurrentUser() actor: Actor,
    @Query('from') from?: string,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ): Promise<RoomBoardRecord> {
    return this.board.board(actor, { from: from || undefined, days });
  }
}
