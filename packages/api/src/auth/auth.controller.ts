import type { AccountRecord, Actor, LoginResult } from '@knazawy/shared';
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto): Promise<LoginResult> {
    return this.auth.login(body);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() actor: Actor): Promise<AccountRecord> {
    return this.auth.account(actor);
  }
}
