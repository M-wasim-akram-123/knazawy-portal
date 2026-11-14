import type { Actor, InvoiceRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateInvoiceDto, CreditInvoiceDto } from './invoices.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<InvoiceRecord[]> {
    return this.invoices.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateInvoiceDto): Promise<InvoiceRecord> {
    return this.invoices.create(actor, body);
  }

  @Post(':id/issue')
  issue(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<InvoiceRecord> {
    return this.invoices.issue(actor, id);
  }

  @Post(':id/credit')
  credit(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreditInvoiceDto,
  ): Promise<InvoiceRecord> {
    return this.invoices.credit(actor, id, body);
  }
}
