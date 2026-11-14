import type { Actor, GoodsReceiptRecord } from '@knazawy/shared';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateReceiptDto } from './receipts.dto';
import { ReceiptsService } from './receipts.service';

@ApiTags('Goods received')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<GoodsReceiptRecord[]> {
    return this.receipts.list(actor);
  }

  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body() body: CreateReceiptDto,
  ): Promise<GoodsReceiptRecord> {
    return this.receipts.create(actor, body);
  }
}
