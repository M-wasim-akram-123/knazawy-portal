import {
  canManageUsers,
  passwordError,
  roleFitsOrganisation,
  userChangeError,
  type Actor,
  type Role,
  type UserAccountRecord,
  type UserChange,
} from '@knazawy/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { AuditService } from '../audit/audit.service';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateUserDto, UpdateUserDto } from './users.dto';

const userInclude = {
  organisation: { select: { name: true, type: true } },
  branch: { select: { name: true } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor): Promise<UserAccountRecord[]> {
    this.assertAdmin(actor);
    const rows = await this.prisma.user.findMany({
      where: { organisation: { type: { in: ['KARAM', 'AIRLINE'] } } },
      include: userInclude,
      orderBy: [{ organisation: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map(toAccount);
  }

  async create(actor: Actor, input: CreateUserDto): Promise<UserAccountRecord> {
    this.assertAdmin(actor);
    const organisationId = input.organisationId?.trim() || actor.organisationId;
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { id: true, type: true },
    });
    if (!organisation || !['KARAM', 'AIRLINE'].includes(organisation.type)) {
      throw new BadRequestException('Choose Karam or an airline for this account.');
    }
    const staff = organisation.type === 'KARAM';
    if (!roleFitsOrganisation(input.role, staff)) {
      throw new BadRequestException(
        staff ? 'Choose a staff role for a Karam account.' : 'Choose an airline role.',
      );
    }
    const problem = passwordError(input.password);
    if (problem) throw new BadRequestException(problem);
    const branchId = staff ? await this.branchFor(organisationId, input.branchId) : null;
    const passwordHash = await bcrypt.hash(input.password, 10);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            organisationId,
            branchId,
            name: requiredName(input.name),
            email: input.email.trim().toLowerCase(),
            role: input.role,
            status: 'ACTIVE',
            passwordHash,
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'User',
          entityId: user.id,
          action: 'create',
          after: { organisationId, email: user.email, name: user.name, role: user.role },
        });
        return user.id;
      });
      return this.load(id);
    } catch (error) {
      rethrowUnique(error, 'Someone already uses this email.');
    }
  }

  async update(actor: Actor, id: string, input: UpdateUserDto): Promise<UserAccountRecord> {
    this.assertAdmin(actor);
    const existing = await this.find(id);
    const staff = existing.organisation.type === 'KARAM';
    const role = input.role ?? existing.role;
    if (!roleFitsOrganisation(role, staff)) {
      throw new BadRequestException(staff ? 'Choose a staff role.' : 'Choose an airline role.');
    }
    if (role !== existing.role) await this.assertChange(actor, existing, 'demote');
    const branchId =
      staff && input.branchId !== undefined
        ? await this.branchFor(existing.organisationId, input.branchId)
        : existing.branchId;
    const data = {
      name: input.name === undefined ? existing.name : requiredName(input.name),
      email: input.email === undefined ? existing.email : input.email.trim().toLowerCase(),
      role,
      branchId,
    };
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'User',
          entityId: id,
          action: 'update',
          before: { name: existing.name, email: existing.email, role: existing.role },
          after: data,
        });
      });
    } catch (error) {
      rethrowUnique(error, 'Someone already uses this email.');
    }
    return this.load(id);
  }

  /** Sets a new password. Every session the person had is signed out. */
  async setPassword(actor: Actor, id: string, password: string): Promise<UserAccountRecord> {
    this.assertAdmin(actor);
    const problem = passwordError(password);
    if (problem) throw new BadRequestException(problem);
    await this.find(id);
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        // A second back, so a token issued in this same second is also refused.
        data: { passwordHash, passwordChangedAt: new Date(Date.now() + 1000) },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'User',
        entityId: id,
        action: 'password',
      });
    });
    return this.load(id);
  }

  /** Revoking takes effect on the person's next request: the API checks status every time. */
  async setStatus(actor: Actor, id: string, status: UserStatus): Promise<UserAccountRecord> {
    this.assertAdmin(actor);
    const existing = await this.find(id);
    if (status === 'DISABLED') await this.assertChange(actor, existing, 'revoke');
    if (existing.status === status) return toAccount(existing);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status } });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'User',
        entityId: id,
        action: status === 'DISABLED' ? 'revoke' : 'restore',
        before: { status: existing.status },
        after: { status },
      });
    });
    return this.load(id);
  }

  /**
   * Deletes an account that has never made or decided anything. Anyone with history is kept,
   * so orders, invoices, and stays still show who made them; revoke them instead.
   */
  async remove(actor: Actor, id: string): Promise<void> {
    this.assertAdmin(actor);
    const existing = await this.find(id);
    await this.assertChange(actor, existing, 'delete');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'User',
          entityId: id,
          action: 'delete',
          before: { email: existing.email, name: existing.name, role: existing.role },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          `${existing.name} has records in the system, so the account stays. Revoke it instead.`,
        );
      }
      throw error;
    }
  }

  private assertAdmin(actor: Actor): void {
    if (!canManageUsers(actor.role)) throw new ForbiddenException('You cannot manage accounts.');
  }

  private async assertChange(actor: Actor, target: UserRow, change: UserChange): Promise<void> {
    const activeAdministrators = await this.prisma.user.count({
      where: { role: 'ADMINISTRATOR', status: 'ACTIVE', organisation: { type: 'KARAM' } },
    });
    const problem = userChangeError({ change, actorId: actor.id, target, activeAdministrators });
    if (problem) throw new BadRequestException(problem);
  }

  private async branchFor(organisationId: string, branchId: string | undefined) {
    if (!branchId) return null;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organisationId, active: true },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException('Choose an open branch.');
    return branch.id;
  }

  private async find(id: string): Promise<UserRow> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!row || !['KARAM', 'AIRLINE'].includes(row.organisation.type)) {
      throw new NotFoundException('That account was not found.');
    }
    return row;
  }

  private async load(id: string): Promise<UserAccountRecord> {
    return toAccount(await this.find(id));
  }
}

function requiredName(value: string): string {
  const name = value.trim();
  if (!name) throw new BadRequestException('Enter a name.');
  return name;
}

function toAccount(row: UserRow): UserAccountRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status,
    organisationId: row.organisationId,
    organisationName: row.organisation.name,
    staff: row.organisation.type === 'KARAM',
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
