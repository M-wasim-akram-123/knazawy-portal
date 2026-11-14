import {
  isAirlineRole,
  type Actor,
  type AirlineRecord,
  type AirlineRole,
  type Role,
} from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateAirlineDto,
  CreateAirlineUserDto,
  UpdateAirlineDto,
  UpdateAirlineUserDto,
} from './airlines.dto';

const airlineInclude = {
  users: { orderBy: { name: 'asc' as const } },
} satisfies Prisma.OrganisationInclude;

type AirlineRow = Prisma.OrganisationGetPayload<{ include: typeof airlineInclude }>;
type AirlineUserRow = AirlineRow['users'][number];

const CODE = /^[A-Z0-9][A-Z0-9-]{1,11}$/;

@Injectable()
export class AirlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor): Promise<AirlineRecord[]> {
    assertCan(actor, 'users', 'R', 'view airlines');
    const rows = await this.prisma.organisation.findMany({
      where: { type: 'AIRLINE' },
      include: airlineInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(toAirline);
  }

  async create(actor: Actor, input: CreateAirlineDto): Promise<AirlineRecord> {
    assertCan(actor, 'users', 'C', 'add an airline');
    const code = normaliseCode(input.code);
    const name = requiredName(input.name);
    const taxNumber = blankToNull(input.taxNumber);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const airline = await tx.organisation.create({
          data: { code, type: 'AIRLINE', name, taxNumber },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Organisation',
          entityId: airline.id,
          action: 'create',
          after: { code, type: 'AIRLINE', name, taxNumber },
        });
        return airline.id;
      });
      return this.load(id);
    } catch (error) {
      rethrowUnique(error, 'An airline with this code already exists.');
    }
  }

  async update(actor: Actor, id: string, input: UpdateAirlineDto): Promise<AirlineRecord> {
    assertCan(actor, 'users', 'U', 'change an airline');
    const existing = await this.findAirline(id);
    const name = input.name === undefined ? existing.name : requiredName(input.name);
    const taxNumber =
      input.taxNumber === undefined ? existing.taxNumber : blankToNull(input.taxNumber);
    await this.prisma.$transaction(async (tx) => {
      await tx.organisation.update({ where: { id }, data: { name, taxNumber } });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Organisation',
        entityId: id,
        action: 'update',
        before: toAirline(existing),
        after: { name, taxNumber },
      });
    });
    return this.load(id);
  }

  async createUser(
    actor: Actor,
    airlineId: string,
    input: CreateAirlineUserDto,
  ): Promise<AirlineRecord> {
    assertCan(actor, 'users', 'C', 'add an airline user');
    await this.findAirline(airlineId);
    const role = airlineRole(input.role);
    const passwordHash = await bcrypt.hash(input.password, 10);
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            organisationId: airlineId,
            name: requiredName(input.name),
            email: normaliseEmail(input.email),
            role,
            status: 'ACTIVE',
            passwordHash,
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'User',
          entityId: user.id,
          action: 'create',
          after: { organisationId: airlineId, name: user.name, email: user.email, role },
        });
      });
    } catch (error) {
      rethrowUnique(error, 'A user with this email already exists.');
    }
    return this.load(airlineId);
  }

  async updateUser(
    actor: Actor,
    airlineId: string,
    userId: string,
    input: UpdateAirlineUserDto,
  ): Promise<AirlineRecord> {
    assertCan(actor, 'users', 'U', 'change an airline user');
    await this.findAirline(airlineId);
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, organisationId: airlineId },
    });
    if (!existing) throw new NotFoundException('That user was not found.');
    const role = input.role === undefined ? existing.role : airlineRole(input.role);
    const passwordHash =
      input.password === undefined ? undefined : await bcrypt.hash(input.password, 10);
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: {
            name: input.name === undefined ? undefined : requiredName(input.name),
            email: input.email === undefined ? undefined : normaliseEmail(input.email),
            role,
            status: input.status,
            passwordHash,
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'User',
          entityId: user.id,
          action: 'update',
          before: {
            name: existing.name,
            email: existing.email,
            role: existing.role,
            status: existing.status,
          },
          after: { name: user.name, email: user.email, role: user.role, status: user.status },
        });
      });
    } catch (error) {
      rethrowUnique(error, 'A user with this email already exists.');
    }
    return this.load(airlineId);
  }

  private async findAirline(id: string): Promise<AirlineRow> {
    const airline = await this.prisma.organisation.findFirst({
      where: { id, type: 'AIRLINE' },
      include: airlineInclude,
    });
    if (!airline) throw new NotFoundException('That airline was not found.');
    return airline;
  }

  private async load(id: string): Promise<AirlineRecord> {
    return toAirline(await this.findAirline(id));
  }
}

function normaliseCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!CODE.test(code)) {
    throw new BadRequestException('Enter a code of 2 to 12 letters or numbers.');
  }
  return code;
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function requiredName(value: string): string {
  const name = value.trim();
  if (!name) throw new BadRequestException('Enter a name.');
  return name;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function airlineRole(role: string): AirlineRole {
  if (!isAirlineRole(role as Role)) {
    throw new BadRequestException('Choose a role for this airline.');
  }
  return role as AirlineRole;
}

function toAirline(row: AirlineRow): AirlineRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    taxNumber: row.taxNumber,
    users: row.users.map(toUser),
  };
}

function toUser(row: AirlineUserRow): AirlineRecord['users'][number] {
  if (!isAirlineRole(row.role)) {
    throw new BadRequestException('Choose a role for this airline.');
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
  };
}
