import {
  DEFAULT_BOARD_DAYS,
  addDays,
  boardDaysError,
  buildRoomBoard,
  canViewRoomBoard,
  roomsToCheckIn,
  todayInKarachi,
  type Actor,
  type RoomBoardRecord,
} from '@knazawy/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { assertCan } from '../auth/permissions';
import { requireBranch } from '../common/branch';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

export interface RoomBoardQuery {
  from?: string;
  days?: number;
}

@Injectable()
export class RoomBoardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every room in the branch Karam staff are working in: who is in it, when they are due out, what
   * is promised ahead, and how many rooms of each type are free on each day of the window.
   */
  async board(actor: Actor, query: RoomBoardQuery): Promise<RoomBoardRecord> {
    assertCan(actor, 'rooms', 'R', 'view the room board');
    if (!canViewRoomBoard(actor.role)) {
      throw new ForbiddenException('You cannot see the room board.');
    }
    const branchId = requireBranch(actor);
    const days = query.days ?? DEFAULT_BOARD_DAYS;
    const daysError = boardDaysError(days);
    if (daysError) throw new BadRequestException(daysError);

    const now = new Date();
    const today = todayInKarachi(now);
    const from = query.from ? formatIsoDate(parseIsoDate(query.from)) : today;
    const until = addDays(from, days);
    // A room promised for tonight still counts as "next" when the window starts later.
    const reachBack = parseIsoDate(from < today ? from : today);

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organisationId: actor.organisationId },
      select: { name: true },
    });
    if (!branch) throw new NotFoundException('That branch was not found.');

    const rooms = await this.prisma.hotelRoom.findMany({
      where: { organisationId: actor.organisationId, active: true, floor: { branchId } },
      include: {
        floor: { select: { id: true, name: true, sortOrder: true } },
        roomType: { select: { id: true, name: true } },
      },
    });
    const roomIds = rooms.map((room) => room.id);

    const [stays, reservations, lines] = await Promise.all([
      this.prisma.roomStay.findMany({
        where: {
          hotelRoomId: { in: roomIds },
          OR: [{ checkedOutAt: null }, { checkedOutAt: { gte: reachBack } }],
        },
        include: {
          requestLine: {
            select: {
              request: {
                select: {
                  id: true,
                  number: true,
                  checkOut: true,
                  organisation: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.roomReservation.findMany({
        where: {
          hotelRoomId: { in: roomIds },
          requestLine: {
            request: { status: 'ACCEPTED', checkOut: { gt: reachBack } },
          },
        },
        include: {
          requestLine: {
            select: {
              request: {
                select: {
                  id: true,
                  number: true,
                  checkIn: true,
                  checkOut: true,
                  organisation: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.roomRequestLine.findMany({
        where: {
          request: {
            status: 'ACCEPTED',
            branchId,
            checkOut: { gt: parseIsoDate(from) },
            checkIn: { lt: parseIsoDate(until) },
          },
        },
        include: {
          request: { select: { checkIn: true, checkOut: true } },
          _count: { select: { stays: true } },
        },
      }),
    ]);

    return buildRoomBoard({
      branchId,
      branchName: branch.name,
      now,
      from,
      days,
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        floorId: room.floor.id,
        floorName: room.floor.name,
        floorOrder: room.floor.sortOrder,
        roomTypeId: room.roomType.id,
        roomTypeName: room.roomType.name,
        capacity: room.capacity,
      })),
      stays: stays.map((stay) => ({
        id: stay.id,
        hotelRoomId: stay.hotelRoomId,
        requestId: stay.requestLine.request.id,
        requestNumber: stay.requestLine.request.number,
        airlineName: stay.requestLine.request.organisation.name,
        checkOutDate: formatIsoDate(stay.requestLine.request.checkOut),
        checkOutTime: stay.checkOutTime,
        checkedInAt: stay.checkedInAt.toISOString(),
        checkedOutAt: stay.checkedOutAt?.toISOString() ?? null,
        guests: {
          male: stay.guestsMale,
          female: stay.guestsFemale,
          children: stay.guestsChildren,
        },
      })),
      reservations: reservations.map((row) => ({
        id: row.id,
        hotelRoomId: row.hotelRoomId,
        requestId: row.requestLine.request.id,
        requestNumber: row.requestLine.request.number,
        airlineName: row.requestLine.request.organisation.name,
        checkInDate: formatIsoDate(row.requestLine.request.checkIn),
        checkOutDate: formatIsoDate(row.requestLine.request.checkOut),
      })),
      promises: lines.map((line) => ({
        roomTypeId: line.roomTypeId,
        checkInDate: formatIsoDate(line.request.checkIn),
        checkOutDate: formatIsoDate(line.request.checkOut),
        rooms: line.quantity,
        toCheckIn: roomsToCheckIn(line.quantity, line._count.stays),
      })),
    });
  }
}
