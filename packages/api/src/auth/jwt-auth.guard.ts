import {
  SESSION_CLIENT_HEADER,
  isSessionClient,
  sessionCookieName,
  tokenStillValid,
  type Actor,
} from '@knazawy/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';

export type AuthenticatedRequest = Request & { user?: Actor; accessToken?: string };

/**
 * The access token from a Bearer header (scripts and tests), or from the app's httpOnly cookie.
 * The cookie counts only when the request names its app in the client header, which another
 * site cannot add, so a cross-site form or link never acts with the cookie.
 */
export function accessTokenFrom(request: Request): string {
  const header = request.header('authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length);
  const client = request.header(SESSION_CLIENT_HEADER);
  if (!isSessionClient(client)) return '';
  const cookies = (request as Request & { cookies?: Record<string, unknown> }).cookies ?? {};
  const value = cookies[sessionCookieName(client)];
  return typeof value === 'string' ? value : '';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = accessTokenFrom(request);
    if (!token) throw new UnauthorizedException('Sign in to continue.');

    let userId = '';
    let issuedAt = 0;
    try {
      const payload: { sub?: string; iat?: number } = await this.jwt.verifyAsync(token);
      userId = payload.sub ?? '';
      issuedAt = payload.iat ?? 0;
    } catch {
      throw new UnauthorizedException('Sign in to continue.');
    }
    if (!userId) throw new UnauthorizedException('Sign in to continue.');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE' || !tokenStillValid(issuedAt, user.passwordChangedAt)) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    request.accessToken = token;
    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organisationId: user.organisationId,
      branchId: user.branchId,
    };
    return true;
  }
}
