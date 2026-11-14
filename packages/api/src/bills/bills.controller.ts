import type { Actor, GoodsReceiptRecord } from '@knazawy/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { PostBillDto } from './bills.dto';
import { BillsService, type IncomingBill } from './bills.service';

@ApiTags('Supplier bills')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('bill', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  post(
    @CurrentUser() actor: Actor,
    @Body() body: PostBillDto,
    @UploadedFile() file: IncomingBill | undefined,
  ): Promise<GoodsReceiptRecord> {
    return this.bills.post(actor, body, file);
  }

  @Get(':receiptId/file')
  async file(
    @CurrentUser() actor: Actor,
    @Param('receiptId') receiptId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.bills.readFile(actor, receiptId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '')}"`);
    response.send(file.bytes);
  }
}
