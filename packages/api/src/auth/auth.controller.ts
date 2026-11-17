import {
  SESSION_CLIENT_HEADER,
  SESSION_CLIENTS,
  isSessionClient,
  sessionCookieName,
  type AccountRecord,
  type Actor,
  type LoginResult,
} from '@knazawy/shared';
import { Body, Controller, Get, Headers, HttpCode, Ip, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './login.dto';

/** Matches the token lifetime in AuthModule. */
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/v1',
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * A browser app names itself in the client header and gets an httpOnly cookie. The token is
   * also returned for scripts and tests that send it as a Bearer header; the apps never store it.
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Ip() address: string,
    @Headers(SESSION_CLIENT_HEADER) client: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResult> {
    const result = await this.auth.login(body, address);
    if (isSessionClient(client)) {
      response.cookie(sessionCookieName(client), result.accessToken, {
        ...cookieOptions(),
        maxAge: SESSION_MAX_AGE_MS,
      });
    }
    return result;
  }

  /** Ends the browser session. Works without a valid token, so an expired session can sign out. */
  @Post('logout')
  @HttpCode(204)
  logout(
    @Headers(SESSION_CLIENT_HEADER) client: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): void {
    const clients = isSessionClient(client) ? [client] : SESSION_CLIENTS;
    for (const name of clients) response.clearCookie(sessionCookieName(name), cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() actor: Actor): Promise<AccountRecord> {
    return this.auth.account(actor);
  }
}
