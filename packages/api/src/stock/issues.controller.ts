import type { Actor, StockIssueRecord } from '@knazawy/shared';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateIssueDto } from './issues.dto';
import { IssuesService } from './issues.service';

@ApiTags('Stock issues')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stock/issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<StockIssueRecord[]> {
    return this.issues.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateIssueDto): Promise<StockIssueRecord> {
    return this.issues.create(actor, body);
  }
}
