import type { Actor, BillableRequestOption, InvoiceRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateInvoiceDto, CreateManualInvoiceDto, CreditInvoiceDto } from './invoices.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('billable-requests')
  billableRequests(@CurrentUser() actor: Actor): Promise<BillableRequestOption[]> {
    return this.invoices.billableRequests(actor);
  }

  @Get()
  list(@CurrentUser() actor: Actor): Promise<InvoiceRecord[]> {
    return this.invoices.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateInvoiceDto): Promise<InvoiceRecord> {
    return this.invoices.create(actor, body);
  }

  @Post('manual')
  createManual(
    @CurrentUser() actor: Actor,
    @Body() body: CreateManualInvoiceDto,
  ): Promise<InvoiceRecord> {
    return this.invoices.createManual(actor, body);
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
