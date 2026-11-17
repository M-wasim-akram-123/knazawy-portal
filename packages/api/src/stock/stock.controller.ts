import type { Actor, LowStockRecord, StockOnHandRecord } from '@knazawy/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { StockService } from './stock.service';

@ApiTags('Stock')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  onHand(@CurrentUser() actor: Actor): Promise<StockOnHandRecord[]> {
    return this.stock.onHand(actor);
  }

  /** Items to buy again: at or below their reorder level in this branch. */
  @Get('low')
  lowStock(@CurrentUser() actor: Actor): Promise<LowStockRecord[]> {
    return this.stock.lowStock(actor);
  }
}
