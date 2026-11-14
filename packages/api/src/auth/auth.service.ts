import type { LoginResult } from '@knazawy/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

import type { LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginDto): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches =
      user?.status === UserStatus.ACTIVE && (await bcrypt.compare(input.password, user.passwordHash));
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Email or password is wrong.');
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organisationId: user.organisationId,
      },
    };
  }
}
