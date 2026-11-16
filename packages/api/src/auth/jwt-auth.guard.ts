import type { Actor } from '@knazawy/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: Actor }>();
    const header = request.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!token) throw new UnauthorizedException('Sign in to continue.');

    let userId = '';
    try {
      const payload: { sub?: string } = await this.jwt.verifyAsync(token);
      userId = payload.sub ?? '';
    } catch {
      throw new UnauthorizedException('Sign in to continue.');
    }
    if (!userId) throw new UnauthorizedException('Sign in to continue.');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sign in to continue.');
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organisationId: user.organisationId,
    };
    return true;
  }
}
