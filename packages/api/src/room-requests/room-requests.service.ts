import {
  canManageRoomStays,
  formatDisplayDate,
  isKaramRole,
  isRoomRequestEditable,
  nightlyChargeTotal,
  nextRoomRequestStatus,
  roomAvailabilityError,
  roomLineError,
  roomNights,
  roomStayWindowError,
  roomStockError,
  roomsStillFree,
  roomsToCheckIn,
  stayLineAmount,
  stayTotal,
  todayInKarachi,
  type Actor,
  type FreeRoomRecord,
  type RoomOfferRecord,
  type RoomRequestLineRecord,
  type RoomRequestRecord,
  type RoomRequestStatus,
  type RoomStayRecord,
} from '@knazawy/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { nextDocumentNumber } from '../common/document-number';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

import type { RoomRequestDto } from './room-requests.dto';

const requestInclude = {
  organisation: { select: { name: true } },
  createdBy: { select: { name: true } },
  lines: {
    include: {
      roomType: {
        select: {
          name: true,
          charges: { select: { amountPerNight: true, active: true } },
        },
      },
      stays: {
        include: { hotelRoom: { select: { name: true, floor: { select: { name: true } } } } },
        orderBy: { checkedInAt: 'asc' },
      },
    },
  },
} satisfies Prisma.RoomRequestInclude;

type RequestRow = Prisma.RoomRequestGetPayload<{ include: typeof requestInclude }>;

interface Stay {
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

interface LineInput {
  roomTypeId: string;
  rooms: number;
}

@Injectable()
export class RoomRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Karam sees a room request once it is sent. An airline sees only its own, and never which rooms guests are in. */
  async list(actor: Actor): Promise<RoomRequestRecord[]> {
    assertCan(actor, 'room_requests', 'R', 'view room requests');
    const rows = await this.prisma.roomRequest.findMany({
      where: isKaramRole(actor.role)
        ? { status: { not: 'DRAFT' } }
        : { organisationId: actor.organisationId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => {
      const record = toRequest(row);
      return isKaramRole(actor.role) ? record : { ...record, stays: [] };
    });
  }

  /** Active room types and how many rooms Karam has. Floors and room names stay private. */
  async offers(actor: Actor): Promise<RoomOfferRecord[]> {
    assertCan(actor, 'room_requests', 'R', 'view room types');
    const karamOrgId = await this.karamOrganisationId();
    const types = await this.prisma.roomType.findMany({
      where: { organisationId: karamOrgId, active: true },
      include: {
        charges: true,
        _count: { select: { rooms: { where: { active: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    return types.map((roomType) => ({
      id: roomType.id,
      name: roomType.name,
      nightlyTotal:
        nightlyChargeTotal(
          roomType.charges.map((charge) => ({
            amountPerNight: charge.amountPerNight.toFixed(2),
            active: charge.active,
          })),
        ) ?? '0.00',
      rooms: roomType._count.rooms,
    }));
  }

  async create(actor: Actor, input: RoomRequestDto): Promise<RoomRequestRecord> {
    assertCan(actor, 'room_requests', 'C', 'ask for rooms');
    this.assertAirline(actor);
    const stay = stayFrom(input);
    const lines = linesFrom(input.lines, stay.nights);
    const fields = requestFields(input);
    const karamOrgId = await this.karamOrganisationId();

    const id = await this.prisma.$transaction(async (tx) => {
      await this.ensureTypes(tx, karamOrgId, lines);
      const number = await nextDocumentNumber(tx, karamOrgId, 'ROOM_REQUEST');
      const request = await tx.roomRequest.create({
        data: {
          organisationId: actor.organisationId,
          number,
          createdById: actor.id,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          ...fields,
          lines: {
            create: lines.map((line) => ({ roomTypeId: line.roomTypeId, quantity: line.rooms })),
          },
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomRequest',
        entityId: request.id,
        action: 'create',
        after: { number, status: 'DRAFT', ...fields, lines },
      });
      return request.id;
    });
    return this.load(id);
  }

  async update(actor: Actor, id: string, input: RoomRequestDto): Promise<RoomRequestRecord> {
    assertCan(actor, 'room_requests', 'U', 'change a room request');
    this.assertAirline(actor);
    const existing = await this.findOwn(actor, id);
    if (!isRoomRequestEditable(existing.status)) {
      throw new BadRequestException('Only a draft can be changed.');
    }
    const stay = stayFrom(input);
    const lines = linesFrom(input.lines, stay.nights);
    const fields = requestFields(input);
    const karamOrgId = await this.karamOrganisationId();

    await this.prisma.$transaction(async (tx) => {
      await this.ensureTypes(tx, karamOrgId, lines);
      await tx.roomRequest.update({
        where: { id },
        data: { checkIn: stay.checkIn, checkOut: stay.checkOut, ...fields },
      });
      await tx.roomRequestLine.deleteMany({ where: { requestId: id } });
      await tx.roomRequestLine.createMany({
        data: lines.map((line) => ({
          requestId: id,
          roomTypeId: line.roomTypeId,
          quantity: line.rooms,
        })),
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomRequest',
        entityId: id,
        action: 'update',
        before: { status: existing.status },
        after: { ...fields, lines },
      });
    });
    return this.load(id);
  }

  async submit(actor: Actor, id: string): Promise<RoomRequestRecord> {
    assertCan(actor, 'room_requests', 'U', 'send a room request');
    this.assertAirline(actor);
    const existing = await this.findOwn(actor, id);
    const next = nextRoomRequestStatus(existing.status, 'submit');
    if (!next) throw new BadRequestException('Only a draft can be sent.');
    if (existing.lines.length === 0) {
      throw new BadRequestException('Add a room type before you send the request.');
    }
    stayFrom({
      checkIn: formatIsoDate(existing.checkIn),
      checkOut: formatIsoDate(existing.checkOut),
    });
    const karamOrgId = await this.karamOrganisationId();

    await this.prisma.$transaction(async (tx) => {
      await this.ensureAvailable(tx, karamOrgId, existing);
      await tx.roomRequest.update({
        where: { id },
        data: { status: next, submittedAt: new Date() },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomRequest',
        entityId: id,
        action: 'submit',
        before: { status: existing.status },
        after: { status: next },
      });
      await this.notifications.notify(tx, {
        organisationId: karamOrgId,
        role: 'OPERATIONS_MANAGER',
        title: `${existing.number} was sent`,
        body: `${existing.organisation.name} asked for rooms from ${formatDisplayDate(formatIsoDate(existing.checkIn))} to ${formatDisplayDate(formatIsoDate(existing.checkOut))}.`,
        entity: 'RoomRequest',
        entityId: id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  async cancel(actor: Actor, id: string): Promise<RoomRequestRecord> {
    assertCan(actor, 'room_requests', 'U', 'cancel a room request');
    this.assertAirline(actor);
    const existing = await this.findOwn(actor, id);
    const next = nextRoomRequestStatus(existing.status, 'cancel');
    if (!next) throw new BadRequestException('This request can no longer be cancelled.');
    await this.decide(actor, existing, next, null);
    return this.load(id);
  }

  async accept(actor: Actor, id: string): Promise<RoomRequestRecord> {
    assertCan(actor, 'room_requests', 'A', 'accept a room request');
    const existing = await this.findSent(id);
    const next = nextRoomRequestStatus(existing.status, 'accept');
    if (!next) throw new BadRequestException('Only a submitted request can be accepted.');
    const karamOrgId = await this.karamOrganisationId();

    await this.prisma.$transaction(async (tx) => {
      await this.ensureAvailable(tx, karamOrgId, existing, true);
      for (const line of existing.lines) {
        const roomType = await tx.roomType.findFirst({
          where: { id: line.roomTypeId, organisationId: karamOrgId, active: true },
          include: { charges: true },
        });
        if (!roomType) throw new BadRequestException('That room type is no longer available.');
        const nightly = nightlyOf(roomType.charges);
        await tx.roomRequestLine.update({
          where: { id: line.id },
          data: { nightlyQuoted: nightly },
        });
      }
      await tx.roomRequest.update({
        where: { id },
        data: { status: next, decidedAt: new Date(), decidedById: actor.id, decisionNote: null },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomRequest',
        entityId: id,
        action: 'accept',
        before: { status: existing.status },
        after: { status: next },
      });
      await this.notifications.notify(tx, {
        organisationId: existing.organisationId,
        role: 'AIRLINE_REQUESTER',
        title: `${existing.number} is accepted`,
        body: `Karam accepted ${existing.number}.`,
        entity: 'RoomRequest',
        entityId: id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  async reject(actor: Actor, id: string, input: { reason: string }): Promise<RoomRequestRecord> {
    assertCan(actor, 'room_requests', 'A', 'reject a room request');
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Give a reason for rejecting this request.');
    }
    const existing = await this.findSent(id);
    const next = nextRoomRequestStatus(existing.status, 'reject');
    if (!next) throw new BadRequestException('Only a submitted request can be rejected.');
    await this.decide(actor, existing, next, reason);
    return this.load(id);
  }

  /** Rooms of an accepted stay that Karam can check a guest in to now, by room type. */
  async freeRooms(actor: Actor, id: string): Promise<FreeRoomRecord[]> {
    assertCanManageStays(actor);
    const existing = await this.findSent(id);
    assertOpenStay(existing);
    const karamOrgId = await this.karamOrganisationId();
    const wanted = [...remainingByType(existing.lines).entries()]
      .filter(([, line]) => line.left > 0)
      .map(([roomTypeId]) => roomTypeId);
    if (wanted.length === 0) return [];

    const rooms = await this.prisma.hotelRoom.findMany({
      where: {
        organisationId: karamOrgId,
        active: true,
        roomTypeId: { in: wanted },
        stays: { none: { checkedOutAt: null } },
      },
      include: {
        floor: { select: { name: true, sortOrder: true } },
        roomType: { select: { name: true } },
      },
    });
    return rooms
      .sort(
        (left, right) =>
          left.floor.sortOrder - right.floor.sortOrder ||
          left.floor.name.localeCompare(right.floor.name) ||
          left.name.localeCompare(right.name),
      )
      .map((room) => ({
        id: room.id,
        name: room.name,
        floorName: room.floor.name,
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomType.name,
      }));
  }

  /** Moves guests into the rooms Karam picked. A room can hold one guest at a time. */
  async checkIn(
    actor: Actor,
    id: string,
    input: { hotelRoomIds: string[] },
  ): Promise<RoomRequestRecord> {
    assertCanManageStays(actor);
    const ids = input.hotelRoomIds;
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Pick each room once.');
    const existing = await this.findSent(id);
    assertOpenStay(existing);
    const karamOrgId = await this.karamOrganisationId();

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM hotel_rooms WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const rooms = await tx.hotelRoom.findMany({
        where: { id: { in: ids }, organisationId: karamOrgId, active: true },
        include: {
          roomType: { select: { id: true, name: true } },
          stays: { where: { checkedOutAt: null }, select: { id: true } },
        },
      });
      if (rooms.length !== ids.length) {
        throw new BadRequestException('One of the rooms is not available. Choose it again.');
      }
      const remaining = remainingByType(existing.lines);
      const now = new Date();
      for (const room of rooms) {
        if (room.stays.length > 0) {
          throw new BadRequestException(`Room ${room.name} already has a guest.`);
        }
        const line = remaining.get(room.roomTypeId);
        if (!line) {
          throw new BadRequestException(
            `Room ${room.name} is not one of the room types on this stay.`,
          );
        }
        if (line.left < 1) {
          throw new BadRequestException(
            `All the ${line.name} rooms on this stay are already checked in.`,
          );
        }
        line.left -= 1;
        await tx.roomStay.create({
          data: {
            organisationId: karamOrgId,
            requestLineId: line.lineId,
            hotelRoomId: room.id,
            checkedInAt: now,
            checkedInById: actor.id,
          },
        });
      }
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomRequest',
        entityId: id,
        action: 'check_in',
        after: { rooms: rooms.map((room) => room.name) },
      });
    });
    return this.load(id);
  }

  /** Releases one room. The request keeps its number and its nightly price. */
  async checkOut(actor: Actor, id: string, stayId: string): Promise<RoomRequestRecord> {
    assertCanManageStays(actor);
    const existing = await this.findSent(id);
    if (existing.status !== 'ACCEPTED') {
      throw new BadRequestException('Only an accepted request has guests to check out.');
    }
    const stay = existing.lines.flatMap((line) => line.stays).find((row) => row.id === stayId);
    if (!stay) throw new NotFoundException('That room was not found on this stay.');
    if (stay.checkedOutAt) {
      throw new BadRequestException('This room has already been checked out.');
    }

    await this.prisma.$transaction(async (tx) => {
      const released = await tx.roomStay.updateMany({
        where: { id: stayId, checkedOutAt: null },
        data: { checkedOutAt: new Date(), checkedOutById: actor.id },
      });
      if (released.count !== 1) {
        throw new BadRequestException('This room has already been checked out.');
      }
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomRequest',
        entityId: id,
        action: 'check_out',
        before: { stayId, checkedOutAt: null },
        after: { stayId, room: stay.hotelRoom.name },
      });
    });
    return this.load(id);
  }

  private async decide(
    actor: Actor,
    existing: RequestRow,
    next: RoomRequestStatus,
    decisionNote: string | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.roomRequest.update({
        where: { id: existing.id },
        data: {
          status: next,
          decidedAt: new Date(),
          decidedById: actor.id,
          decisionNote,
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomRequest',
        entityId: existing.id,
        action: next === 'CANCELLED' ? 'cancel' : 'reject',
        before: { status: existing.status },
        after: { status: next, decisionNote },
      });
      if (next === 'REJECTED' && decisionNote) {
        await this.notifications.notify(tx, {
          organisationId: existing.organisationId,
          role: 'AIRLINE_REQUESTER',
          title: `${existing.number} was rejected`,
          body: decisionNote,
          entity: 'RoomRequest',
          entityId: existing.id,
          exceptUserId: actor.id,
        });
      }
      if (next === 'CANCELLED' && existing.status === 'SUBMITTED') {
        const karamOrgId = await this.karamOrganisationId();
        await this.notifications.notify(tx, {
          organisationId: karamOrgId,
          role: 'OPERATIONS_MANAGER',
          title: `${existing.number} was cancelled`,
          body: `${existing.organisation.name} cancelled ${existing.number}.`,
          entity: 'RoomRequest',
          entityId: existing.id,
          exceptUserId: actor.id,
        });
      }
    });
  }

  /** Confirms the types exist, then that enough rooms are free. When accepting, the rooms are locked first. */
  private async ensureAvailable(
    tx: Prisma.TransactionClient,
    karamOrgId: string,
    request: RequestRow,
    lock = false,
  ): Promise<void> {
    const lines = request.lines.map((line) => ({
      roomTypeId: line.roomTypeId,
      rooms: line.quantity,
    }));
    await this.ensureTypes(tx, karamOrgId, lines);
    for (const line of request.lines) {
      if (lock) {
        await tx.$queryRaw`SELECT id FROM hotel_rooms WHERE room_type_id = ${line.roomTypeId} AND active = true FOR UPDATE`;
      }
      const active = await tx.hotelRoom.count({
        where: { roomTypeId: line.roomTypeId, organisationId: karamOrgId, active: true },
      });
      const booked = await tx.roomRequestLine.findMany({
        where: {
          roomTypeId: line.roomTypeId,
          request: {
            status: 'ACCEPTED',
            checkIn: { lt: request.checkOut },
            checkOut: { gt: request.checkIn },
          },
        },
        select: { quantity: true },
      });
      const taken = booked.reduce((sum, row) => sum + row.quantity, 0);
      const error = roomAvailabilityError(
        line.roomType.name,
        roomsStillFree(active, taken),
        line.quantity,
      );
      if (error) throw new BadRequestException(error);
    }
  }

  private async ensureTypes(
    tx: Prisma.TransactionClient,
    karamOrgId: string,
    lines: LineInput[],
  ): Promise<void> {
    const ids = lines.map((line) => line.roomTypeId);
    const types = await tx.roomType.findMany({
      where: { id: { in: ids }, organisationId: karamOrgId, active: true },
      include: { _count: { select: { rooms: { where: { active: true } } } } },
    });
    if (types.length !== ids.length) {
      throw new BadRequestException('One of the room types is not available. Choose it again.');
    }
    for (const line of lines) {
      const roomType = types.find((type) => type.id === line.roomTypeId);
      if (!roomType) {
        throw new BadRequestException('One of the room types is not available. Choose it again.');
      }
      const error = roomStockError(roomType.name, roomType._count.rooms, line.rooms);
      if (error) throw new BadRequestException(error);
    }
  }

  private assertAirline(actor: Actor): void {
    if (isKaramRole(actor.role)) {
      throw new ForbiddenException('Only the airline can change a room request.');
    }
  }

  private async findOwn(actor: Actor, id: string): Promise<RequestRow> {
    const row = await this.prisma.roomRequest.findFirst({
      where: { id, organisationId: actor.organisationId },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('That room request was not found.');
    return row;
  }

  private async findSent(id: string): Promise<RequestRow> {
    const row = await this.prisma.roomRequest.findFirst({
      where: { id, status: { not: 'DRAFT' } },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('That room request was not found.');
    return row;
  }

  private async load(id: string): Promise<RoomRequestRecord> {
    const row = await this.prisma.roomRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('That room request was not found.');
    return toRequest(row);
  }

  private async karamOrganisationId(): Promise<string> {
    const karam = await this.prisma.organisation.findFirst({
      where: { type: 'KARAM' },
      select: { id: true },
    });
    if (!karam) throw new NotFoundException('The restaurant account is missing.');
    return karam.id;
  }
}

function assertCanManageStays(actor: Actor): void {
  if (!canManageRoomStays(actor.role)) {
    throw new ForbiddenException('You cannot check guests in or out.');
  }
}

function assertOpenStay(request: RequestRow): void {
  if (request.status !== 'ACCEPTED') {
    throw new BadRequestException('Only an accepted request can be checked in.');
  }
  const error = roomStayWindowError(
    todayInKarachi(),
    formatIsoDate(request.checkIn),
    formatIsoDate(request.checkOut),
  );
  if (error) throw new BadRequestException(error);
}

/** Rooms still to check in, by room type, with the line each one belongs to. */
function remainingByType(
  lines: RequestRow['lines'],
): Map<string, { lineId: string; name: string; left: number }> {
  return new Map(
    lines.map((line) => [
      line.roomTypeId,
      {
        lineId: line.id,
        name: line.roomType.name,
        left: roomsToCheckIn(line.quantity, line.stays.length),
      },
    ]),
  );
}

function stayFrom(input: { checkIn: string; checkOut: string }): Stay {
  const checkIn = parseIsoDate(input.checkIn);
  const checkOut = parseIsoDate(input.checkOut);
  const inIso = formatIsoDate(checkIn);
  const outIso = formatIsoDate(checkOut);
  if (inIso < todayInKarachi()) {
    throw new BadRequestException('Pick a check-in from today on.');
  }
  const nights = roomNights(inIso, outIso);
  if (nights === null) {
    throw new BadRequestException('Check-out is the morning after the last night.');
  }
  return { checkIn, checkOut, nights };
}

function linesFrom(lines: RoomRequestDto['lines'], nights: number): LineInput[] {
  const ids = new Set<string>();
  return lines.map((line) => {
    if (ids.has(line.roomTypeId)) throw new BadRequestException('Use each room type once.');
    ids.add(line.roomTypeId);
    const error = roomLineError(line.rooms, nights);
    if (error) throw new BadRequestException(error);
    return { roomTypeId: line.roomTypeId, rooms: line.rooms };
  });
}

function requestFields(input: RoomRequestDto): { party: string | null; note: string | null } {
  return { party: blankToNull(input.party), note: blankToNull(input.note) };
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function nightlyOf(charges: Array<{ amountPerNight: Prisma.Decimal; active: boolean }>): string {
  const nightly = nightlyChargeTotal(
    charges.map((charge) => ({
      amountPerNight: charge.amountPerNight.toFixed(2),
      active: charge.active,
    })),
  );
  if (nightly === null) {
    throw new BadRequestException('This room type has a charge that is not an amount.');
  }
  return nightly;
}

function toRequest(row: RequestRow): RoomRequestRecord {
  const checkIn = formatIsoDate(row.checkIn);
  const checkOut = formatIsoDate(row.checkOut);
  const nights = roomNights(checkIn, checkOut) ?? 0;
  const lines: RoomRequestLineRecord[] = [...row.lines]
    .sort((left, right) => left.roomType.name.localeCompare(right.roomType.name))
    .map((line) => {
      const quotedAmount = line.nightlyQuoted;
      const nightly = quotedAmount ? quotedAmount.toFixed(2) : nightlyOf(line.roomType.charges);
      return {
        roomTypeId: line.roomTypeId,
        roomTypeName: line.roomType.name,
        rooms: line.quantity,
        nightly,
        amount: stayLineAmount(line.quantity, nights, nightly) ?? '0.00',
        quoted: quotedAmount !== null,
        checkedIn: line.stays.length,
      };
    });
  const stays: RoomStayRecord[] = row.lines.flatMap((line) =>
    line.stays.map((stay) => ({
      id: stay.id,
      roomName: stay.hotelRoom.name,
      floorName: stay.hotelRoom.floor.name,
      roomTypeName: line.roomType.name,
      checkedInAt: stay.checkedInAt.toISOString(),
      checkedOutAt: stay.checkedOutAt?.toISOString() ?? null,
    })),
  );
  return {
    id: row.id,
    number: row.number,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    status: row.status,
    checkIn,
    checkOut,
    nights,
    party: row.party,
    note: row.note,
    decisionNote: row.decisionNote,
    createdByName: row.createdBy.name,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    total:
      stayTotal(
        lines.map((line) => ({ rooms: line.rooms, nightly: line.nightly })),
        nights,
      ) ?? '0.00',
    lines,
    stays: stays.sort((left, right) => left.checkedInAt.localeCompare(right.checkedInAt)),
  };
}
