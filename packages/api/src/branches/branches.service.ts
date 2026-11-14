import {
  branchCloseError,
  branchCodeError,
  branchNameError,
  isKaramRole,
  type Actor,
  type BranchRecord,
} from '@knazawy/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateBranchDto, UpdateBranchDto } from './branches.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Every branch of the Karam organisation, open and closed. An airline has none. */
  async list(actor: Actor): Promise<BranchRecord[]> {
    assertCan(actor, 'branches', 'R', 'view branches');
    const rows = await this.prisma.branch.findMany({
      where: { organisationId: actor.organisationId },
      orderBy: { name: 'asc' },
    });
    return rows.map(toBranch);
  }

  /** Open Karam branches an airline can ask for rooms in. Names only; floors stay private. */
  async forStays(actor: Actor): Promise<BranchRecord[]> {
    assertCan(actor, 'room_requests', 'R', 'view branches');
    const rows = await this.prisma.branch.findMany({
      where: { active: true, organisation: { type: 'KARAM' } },
      orderBy: { name: 'asc' },
    });
    return rows.map(toBranch);
  }

  /** Open branches a Karam user can work in. An airline has none. */
  async open(actor: Actor): Promise<BranchRecord[]> {
    assertKaram(actor, 'view branches');
    const rows = await this.prisma.branch.findMany({
      where: { organisationId: actor.organisationId, active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toBranch);
  }

  /** Moves the signed-in Karam user to an open branch of their organisation. */
  async use(actor: Actor, branchId: string): Promise<BranchRecord> {
    assertKaram(actor, 'change branch');
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organisationId: actor.organisationId, active: true },
    });
    if (!branch) throw new NotFoundException('That branch was not found.');
    await this.prisma.user.update({ where: { id: actor.id }, data: { branchId: branch.id } });
    return toBranch(branch);
  }

  async create(actor: Actor, input: CreateBranchDto): Promise<BranchRecord> {
    assertCan(actor, 'branches', 'C', 'add branches');
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const problem = branchCodeError(code) ?? branchNameError(name);
    if (problem) throw new BadRequestException(problem);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({
          data: { organisationId: actor.organisationId, code, name },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Branch',
          entityId: branch.id,
          action: 'create',
          after: toBranch(branch),
        });
        return branch;
      });
      return toBranch(created);
    } catch (error) {
      rethrowUnique(error, 'A branch already uses that code.');
    }
  }

  async update(actor: Actor, id: string, input: UpdateBranchDto): Promise<BranchRecord> {
    assertCan(actor, 'branches', 'U', 'change branches');
    const existing = await this.prisma.branch.findFirst({
      where: { id, organisationId: actor.organisationId },
    });
    if (!existing) throw new NotFoundException('That branch was not found.');

    const name = input.name === undefined ? existing.name : input.name.trim();
    const nameProblem = branchNameError(name);
    if (nameProblem) throw new BadRequestException(nameProblem);

    const closing = input.active === false && existing.active;
    if (closing) {
      const otherOpen = await this.prisma.branch.count({
        where: { organisationId: actor.organisationId, active: true, id: { not: id } },
      });
      const closeProblem = branchCloseError(existing.active, otherOpen);
      if (closeProblem) throw new BadRequestException(closeProblem);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id },
        data: { name, ...(input.active === undefined ? {} : { active: input.active }) },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Branch',
        entityId: branch.id,
        action: 'update',
        before: toBranch(existing),
        after: toBranch(branch),
      });
      return branch;
    });
    return toBranch(updated);
  }
}

function assertKaram(actor: Actor, action: string): void {
  if (!isKaramRole(actor.role)) throw new ForbiddenException(`You cannot ${action}.`);
}

function toBranch(row: { id: string; code: string; name: string; active: boolean }): BranchRecord {
  return { id: row.id, code: row.code, name: row.name, active: row.active };
}
