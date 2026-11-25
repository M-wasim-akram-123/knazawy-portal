import {
  DEFAULT_ROOM_CAPACITY,
  chargeAmountError,
  nightlyChargeTotal,
  peakRoomsNeeded,
  roomCapacityError,
  roomRemovalError,
  setupNameError,
  todayInKarachi,
  type Actor,
  type HotelRoomRecord,
  type RoomFloorRecord,
  type RoomTypeRecord,
} from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { requireBranch } from '../common/branch';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateChargeDto,
  CreateFloorDto,
  CreateHotelRoomDto,
  CreateRoomTypeDto,
  UpdateChargeDto,
  UpdateFloorDto,
  UpdateHotelRoomDto,
  UpdateRoomTypeDto,
} from './room-setup.dto';

const typeInclude = {
  charges: { orderBy: { name: 'asc' as const } },
} satisfies Prisma.RoomTypeInclude;

type TypeRow = Prisma.RoomTypeGetPayload<{ include: typeof typeInclude }>;

const roomInclude = {
  floor: { select: { name: true, branchId: true } },
  roomType: { select: { name: true } },
} satisfies Prisma.HotelRoomInclude;

type RoomRow = Prisma.HotelRoomGetPayload<{ include: typeof roomInclude }>;

@Injectable()
export class RoomSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listFloors(actor: Actor): Promise<RoomFloorRecord[]> {
    assertCan(actor, 'rooms', 'R', 'view rooms');
    const rows = await this.prisma.roomFloor.findMany({
      where: { organisationId: actor.organisationId, branchId: requireBranch(actor) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toFloor);
  }

  async createFloor(actor: Actor, input: CreateFloorDto): Promise<RoomFloorRecord> {
    assertCan(actor, 'rooms', 'C', 'add a floor');
    const branchId = requireBranch(actor);
    const name = requireName(input.name, 'floor');
    await this.assertNameFree('roomFloor', actor.organisationId, name, undefined, branchId);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const floor = await tx.roomFloor.create({
          data: {
            organisationId: actor.organisationId,
            branchId,
            name,
            sortOrder: input.sortOrder ?? 0,
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'RoomFloor',
          entityId: floor.id,
          action: 'create',
          after: toFloor(floor),
        });
        return floor;
      });
      return toFloor(created);
    } catch (error) {
      rethrowUnique(error, 'That floor name is already used.');
    }
  }

  async updateFloor(actor: Actor, id: string, input: UpdateFloorDto): Promise<RoomFloorRecord> {
    assertCan(actor, 'rooms', 'U', 'change a floor');
    const branchId = requireBranch(actor);
    const existing = await this.requireFloor(actor.organisationId, branchId, id);
    const name = input.name === undefined ? undefined : requireName(input.name, 'floor');
    if (name) await this.assertNameFree('roomFloor', actor.organisationId, name, id, branchId);
    if (input.active === false) {
      const rooms = await this.prisma.hotelRoom.count({
        where: { floorId: id, active: true },
      });
      if (rooms > 0) {
        throw new BadRequestException('Archive the rooms on this floor first.');
      }
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const floor = await tx.roomFloor.update({
          where: { id: existing.id },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
            ...(input.active === undefined ? {} : { active: input.active }),
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'RoomFloor',
          entityId: floor.id,
          action: 'update',
          before: toFloor(existing),
          after: toFloor(floor),
        });
        return floor;
      });
      return toFloor(updated);
    } catch (error) {
      rethrowUnique(error, 'That floor name is already used.');
    }
  }

  async listTypes(actor: Actor): Promise<RoomTypeRecord[]> {
    assertCan(actor, 'rooms', 'R', 'view rooms');
    const rows = await this.prisma.roomType.findMany({
      where: { organisationId: actor.organisationId },
      include: typeInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(toType);
  }

  async createType(actor: Actor, input: CreateRoomTypeDto): Promise<RoomTypeRecord> {
    assertCan(actor, 'rooms', 'C', 'add a room type');
    const name = requireName(input.name, 'room type');
    await this.assertNameFree('roomType', actor.organisationId, name);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const roomType = await tx.roomType.create({
          data: {
            organisationId: actor.organisationId,
            name,
            note: blankToNull(input.note),
          },
          include: typeInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'RoomType',
          entityId: roomType.id,
          action: 'create',
          after: { name, note: roomType.note },
        });
        return roomType;
      });
      return toType(created);
    } catch (error) {
      rethrowUnique(error, 'That room type name is already used.');
    }
  }

  async updateType(actor: Actor, id: string, input: UpdateRoomTypeDto): Promise<RoomTypeRecord> {
    assertCan(actor, 'rooms', 'U', 'change a room type');
    const existing = await this.requireType(actor.organisationId, id);
    const name = input.name === undefined ? undefined : requireName(input.name, 'room type');
    if (name) await this.assertNameFree('roomType', actor.organisationId, name, id);
    if (input.active === false) {
      const rooms = await this.prisma.hotelRoom.count({
        where: { roomTypeId: id, active: true },
      });
      if (rooms > 0) {
        throw new BadRequestException('Archive the rooms of this type first.');
      }
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const roomType = await tx.roomType.update({
          where: { id: existing.id },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(input.note === undefined ? {} : { note: blankToNull(input.note) }),
            ...(input.active === undefined ? {} : { active: input.active }),
          },
          include: typeInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'RoomType',
          entityId: roomType.id,
          action: 'update',
          before: { name: existing.name, active: existing.active },
          after: { name: roomType.name, active: roomType.active },
        });
        return roomType;
      });
      return toType(updated);
    } catch (error) {
      rethrowUnique(error, 'That room type name is already used.');
    }
  }

  async addCharge(actor: Actor, typeId: string, input: CreateChargeDto): Promise<RoomTypeRecord> {
    assertCan(actor, 'rooms', 'C', 'add a charge');
    const roomType = await this.requireType(actor.organisationId, typeId);
    const name = requireName(input.name, 'charge');
    const amount = requireAmount(input.amountPerNight);
    const taken = roomType.charges.find(
      (charge) => charge.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) throw new BadRequestException('That charge name is already used on this room type.');
    try {
      await this.prisma.$transaction(async (tx) => {
        const charge = await tx.roomCharge.create({
          data: { roomTypeId: roomType.id, name, amountPerNight: amount },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'RoomCharge',
          entityId: charge.id,
          action: 'create',
          after: { roomTypeId: roomType.id, name, amountPerNight: amount },
        });
      });
    } catch (error) {
      rethrowUnique(error, 'That charge name is already used on this room type.');
    }
    return this.loadType(roomType.id);
  }

  async updateCharge(
    actor: Actor,
    typeId: string,
    chargeId: string,
    input: UpdateChargeDto,
  ): Promise<RoomTypeRecord> {
    assertCan(actor, 'rooms', 'U', 'change a charge');
    const roomType = await this.requireType(actor.organisationId, typeId);
    const charge = roomType.charges.find((row) => row.id === chargeId);
    if (!charge) throw new NotFoundException('That charge was not found.');
    const name = input.name === undefined ? undefined : requireName(input.name, 'charge');
    const amount =
      input.amountPerNight === undefined ? undefined : requireAmount(input.amountPerNight);
    if (name) {
      const taken = roomType.charges.find(
        (row) => row.id !== chargeId && row.name.toLowerCase() === name.toLowerCase(),
      );
      if (taken)
        throw new BadRequestException('That charge name is already used on this room type.');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.roomCharge.update({
          where: { id: charge.id },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(amount === undefined ? {} : { amountPerNight: amount }),
            ...(input.active === undefined ? {} : { active: input.active }),
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'RoomCharge',
          entityId: charge.id,
          action: 'update',
          before: { name: charge.name, amountPerNight: charge.amountPerNight.toFixed(2) },
          after: { name: name ?? charge.name, amountPerNight: amount, active: input.active },
        });
      });
    } catch (error) {
      rethrowUnique(error, 'That charge name is already used on this room type.');
    }
    return this.loadType(roomType.id);
  }

  async listRooms(actor: Actor): Promise<HotelRoomRecord[]> {
    assertCan(actor, 'rooms', 'R', 'view rooms');
    const rows = await this.prisma.hotelRoom.findMany({
      where: { organisationId: actor.organisationId, floor: { branchId: requireBranch(actor) } },
      include: roomInclude,
      orderBy: [{ floor: { sortOrder: 'asc' } }, { floor: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map(toRoom);
  }

  async createRoom(actor: Actor, input: CreateHotelRoomDto): Promise<HotelRoomRecord> {
    assertCan(actor, 'rooms', 'C', 'add a room');
    const name = requireName(input.name, 'room');
    const capacity = requireCapacity(input.capacity ?? DEFAULT_ROOM_CAPACITY);
    const branchId = requireBranch(actor);
    const floor = await this.requireActiveFloor(actor.organisationId, branchId, input.floorId);
    await this.requireActiveType(actor.organisationId, input.roomTypeId);
    await this.assertRoomNameFree(floor.id, name);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const room = await tx.hotelRoom.create({
          data: {
            organisationId: actor.organisationId,
            floorId: floor.id,
            roomTypeId: input.roomTypeId,
            name,
            capacity,
          },
          include: roomInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'HotelRoom',
          entityId: room.id,
          action: 'create',
          after: toRoom(room),
        });
        return room;
      });
      return toRoom(created);
    } catch (error) {
      rethrowUnique(error, 'That room name is already used on this floor.');
    }
  }

  async updateRoom(actor: Actor, id: string, input: UpdateHotelRoomDto): Promise<HotelRoomRecord> {
    assertCan(actor, 'rooms', 'U', 'change a room');
    const branchId = requireBranch(actor);
    const existing = await this.requireRoom(actor.organisationId, branchId, id);
    const name = input.name === undefined ? undefined : requireName(input.name, 'room');
    const capacity = input.capacity === undefined ? undefined : requireCapacity(input.capacity);
    if (capacity !== undefined) await this.assertCapacityFits(existing.id, capacity);
    const floorId = input.floorId ?? existing.floorId;
    if (input.floorId) await this.requireActiveFloor(actor.organisationId, branchId, input.floorId);
    if (input.roomTypeId) await this.requireActiveType(actor.organisationId, input.roomTypeId);
    if (name || input.floorId) await this.assertRoomNameFree(floorId, name ?? existing.name, id);
    const leavesType =
      existing.active &&
      (input.active === false ||
        (input.roomTypeId !== undefined && input.roomTypeId !== existing.roomTypeId));
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (leavesType) {
          // Same lock as check-in and acceptance, so a stay cannot be accepted while this room leaves.
          await tx.$queryRaw`
            SELECT hotel_rooms.id FROM hotel_rooms
            INNER JOIN room_floors ON room_floors.id = hotel_rooms.floor_id
            WHERE hotel_rooms.room_type_id = ${existing.roomTypeId}
              AND hotel_rooms.active = true
              AND room_floors.branch_id = ${branchId}
            FOR UPDATE
          `;
          await this.assertRoomCanLeave(tx, actor.organisationId, existing);
        }
        const room = await tx.hotelRoom.update({
          where: { id: existing.id },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(input.floorId === undefined ? {} : { floorId: input.floorId }),
            ...(input.roomTypeId === undefined ? {} : { roomTypeId: input.roomTypeId }),
            ...(capacity === undefined ? {} : { capacity }),
            ...(input.active === undefined ? {} : { active: input.active }),
          },
          include: roomInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'HotelRoom',
          entityId: room.id,
          action: 'update',
          before: { name: existing.name, active: existing.active },
          after: toRoom(room),
        });
        return room;
      });
      return toRoom(updated);
    } catch (error) {
      rethrowUnique(error, 'That room name is already used on this floor.');
    }
  }

  /** A room cannot be made smaller than the guests already in it. */
  private async assertCapacityFits(roomId: string, capacity: number): Promise<void> {
    const stay = await this.prisma.roomStay.findFirst({
      where: { hotelRoomId: roomId, checkedOutAt: null },
      select: { guestsMale: true, guestsFemale: true, guestsChildren: true },
    });
    if (!stay) return;
    const guests = stay.guestsMale + stay.guestsFemale + stay.guestsChildren;
    if (guests > capacity) {
      throw new BadRequestException(
        `${guests} guests are in this room. Keep the capacity at ${guests} or more until they check out.`,
      );
    }
  }

  private async assertNameFree(
    model: 'roomFloor' | 'roomType',
    organisationId: string,
    name: string,
    exceptId?: string,
    branchId?: string,
  ): Promise<void> {
    const where = {
      organisationId,
      ...(branchId ? { branchId } : {}),
      name: { equals: name, mode: 'insensitive' as const },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    };
    const existing =
      model === 'roomFloor'
        ? await this.prisma.roomFloor.findFirst({ where, select: { id: true } })
        : await this.prisma.roomType.findFirst({ where, select: { id: true } });
    if (existing) {
      throw new BadRequestException(
        model === 'roomFloor'
          ? 'That floor name is already used.'
          : 'That room type name is already used.',
      );
    }
  }

  private async assertRoomNameFree(
    floorId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.prisma.hotelRoom.findFirst({
      where: {
        floorId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('That room name is already used on this floor.');
  }

  private async requireFloor(organisationId: string, branchId: string, id: string) {
    const floor = await this.prisma.roomFloor.findFirst({
      where: { id, organisationId, branchId },
    });
    if (!floor) throw new NotFoundException('That floor was not found.');
    return floor;
  }

  private async requireActiveFloor(organisationId: string, branchId: string, id: string) {
    const floor = await this.requireFloor(organisationId, branchId, id);
    if (!floor.active) throw new BadRequestException('That floor is archived.');
    return floor;
  }

  private async requireType(organisationId: string, id: string): Promise<TypeRow> {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id, organisationId },
      include: typeInclude,
    });
    if (!roomType) throw new NotFoundException('That room type was not found.');
    return roomType;
  }

  private async requireActiveType(organisationId: string, id: string): Promise<TypeRow> {
    const roomType = await this.requireType(organisationId, id);
    if (!roomType.active) throw new BadRequestException('That room type is archived.');
    return roomType;
  }

  /**
   * A room leaves its type when it is archived or moved. Refused while a guest is in it, and while
   * accepted stays of that type would be left short on any night from today on.
   */
  private async assertRoomCanLeave(
    tx: Prisma.TransactionClient,
    organisationId: string,
    room: RoomRow,
  ): Promise<void> {
    const guests = await tx.roomStay.count({
      where: { hotelRoomId: room.id, checkedOutAt: null },
    });
    if (guests > 0) {
      throw new BadRequestException('A guest is in this room. Check them out first.');
    }
    const today = todayInKarachi();
    const setAside = await tx.roomReservation.findFirst({
      where: {
        hotelRoomId: room.id,
        requestLine: {
          request: { status: 'ACCEPTED', checkOut: { gt: parseIsoDate(today) } },
        },
      },
      select: { requestLine: { select: { request: { select: { number: true } } } } },
    });
    if (setAside) {
      throw new BadRequestException(
        `This room is set aside for ${setAside.requestLine.request.number}. Release it from that stay first.`,
      );
    }
    const roomsLeft = await tx.hotelRoom.count({
      where: {
        organisationId,
        roomTypeId: room.roomTypeId,
        active: true,
        floor: { branchId: room.floor.branchId },
        NOT: { id: room.id },
      },
    });
    const lines = await tx.roomRequestLine.findMany({
      where: {
        roomTypeId: room.roomTypeId,
        request: {
          status: 'ACCEPTED',
          branchId: room.floor.branchId,
          checkOut: { gt: parseIsoDate(today) },
        },
      },
      include: { request: { select: { checkIn: true, checkOut: true } } },
    });
    const peak = peakRoomsNeeded(
      lines.map((line) => ({
        checkIn: formatIsoDate(line.request.checkIn),
        checkOut: formatIsoDate(line.request.checkOut),
        rooms: line.quantity,
      })),
      today,
    );
    const error = roomRemovalError(room.roomType.name, roomsLeft, peak);
    if (error) throw new BadRequestException(error);
  }

  private async requireRoom(
    organisationId: string,
    branchId: string,
    id: string,
  ): Promise<RoomRow> {
    const room = await this.prisma.hotelRoom.findFirst({
      where: { id, organisationId, floor: { branchId } },
      include: roomInclude,
    });
    if (!room) throw new NotFoundException('That room was not found.');
    return room;
  }

  private async loadType(id: string): Promise<RoomTypeRecord> {
    const roomType = await this.prisma.roomType.findUnique({ where: { id }, include: typeInclude });
    if (!roomType) throw new NotFoundException('That room type was not found.');
    return toType(roomType);
  }
}

function requireName(value: string, label: string): string {
  const error = setupNameError(value, label);
  if (error) throw new BadRequestException(error);
  return value.trim();
}

function requireCapacity(value: number): number {
  const error = roomCapacityError(value);
  if (error) throw new BadRequestException(error);
  return value;
}

function requireAmount(value: string): string {
  const error = chargeAmountError(value);
  if (error) throw new BadRequestException(error);
  const amount = value.trim();
  return amount.includes('.') ? amount : `${amount}.00`;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function toFloor(row: {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}): RoomFloorRecord {
  return { id: row.id, name: row.name, sortOrder: row.sortOrder, active: row.active };
}

function toType(row: TypeRow): RoomTypeRecord {
  const charges = row.charges.map((charge) => ({
    id: charge.id,
    name: charge.name,
    amountPerNight: charge.amountPerNight.toFixed(2),
    active: charge.active,
  }));
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    active: row.active,
    nightlyTotal: nightlyChargeTotal(charges) ?? '0.00',
    charges,
  };
}

function toRoom(row: RoomRow): HotelRoomRecord {
  return {
    id: row.id,
    name: row.name,
    floorId: row.floorId,
    floorName: row.floor.name,
    roomTypeId: row.roomTypeId,
    roomTypeName: row.roomType.name,
    capacity: row.capacity,
    active: row.active,
  };
}
