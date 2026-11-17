import type { AccountRecord, Actor, LoginResult } from '@knazawy/shared';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

import { LoginThrottle } from './login-throttle';
import type { LoginDto } from './login.dto';

/** Compared when the email is unknown, so a miss costs as long as a wrong password. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly throttle: LoginThrottle = new LoginThrottle(),
  ) {}

  async login(input: LoginDto, address = 'unknown'): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    this.throttle.assertAllowed(email, address);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const hashMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || user.status !== UserStatus.ACTIVE || !hashMatches) {
      this.throttle.recordFailure(email, address);
      throw new UnauthorizedException('Email or password is wrong.');
    }
    this.throttle.recordSuccess(email);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organisationId: user.organisationId,
        branchId: user.branchId,
      },
    };
  }

  async account(actor: Actor): Promise<AccountRecord> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: actor.organisationId },
    });
    if (!organisation) throw new NotFoundException('That account was not found.');
    const branch = actor.branchId
      ? await this.prisma.branch.findUnique({ where: { id: actor.branchId } })
      : null;
    return {
      id: actor.id,
      email: actor.email,
      name: actor.name,
      role: actor.role,
      organisationId: organisation.id,
      organisationCode: organisation.code,
      organisationName: organisation.name,
      organisationType: organisation.type,
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
    };
  }
}
