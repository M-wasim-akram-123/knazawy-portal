import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { RoomBoardService } from './room-board.service';

const operations = {
  id: 'user-ops',
  email: 'ops@karam.local',
  name: 'Operations',
  role: 'OPERATIONS_MANAGER' as const,
  organisationId: 'org-karam',
  branchId: 'branch-main',
};

const requester = {
  id: 'user-airline',
  email: 'requester@sample.local',
  name: 'Requester',
  role: 'AIRLINE_REQUESTER' as const,
  organisationId: 'org-pia',
};

function mocks() {
  return {
    branch: { findFirst: jest.fn().mockResolvedValue({ name: 'Main' }) },
    hotelRoom: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'room-101',
          name: '101',
          capacity: 2,
          floor: { id: 'floor-1', name: 'Ground', sortOrder: 0 },
          roomType: { id: 'type-1', name: 'Single' },
        },
      ]),
    },
    roomStay: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'stay-1',
          hotelRoomId: 'room-101',
          checkOutTime: '12:00',
          checkedInAt: new Date('2026-11-24T06:00:00.000Z'),
          checkedOutAt: null,
          guestsMale: 1,
          guestsFemale: 1,
          guestsChildren: 0,
          requestLine: {
            request: {
              id: 'rr-1',
              number: 'RR-00001',
              checkOut: new Date('2026-11-28T00:00:00.000Z'),
              organisation: { name: 'Sample Air' },
            },
          },
        },
      ]),
    },
    roomReservation: { findMany: jest.fn().mockResolvedValue([]) },
    roomRequestLine: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('RoomBoardService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-25T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses an airline', async () => {
    const service = new RoomBoardService(mocks() as never);
    await expect(service.board(requester, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a day count the calendar cannot show', async () => {
    const service = new RoomBoardService(mocks() as never);
    await expect(service.board(operations, { days: 10 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('asks for a branch when the user has none', async () => {
    const service = new RoomBoardService(mocks() as never);
    await expect(service.board({ ...operations, branchId: undefined }, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('shows the guests in the branch rooms and when they are due out', async () => {
    const prisma = mocks();
    const service = new RoomBoardService(prisma as never);
    const board = await service.board(operations, {});
    expect(board.branchName).toBe('Main');
    expect(board.days).toHaveLength(14);
    expect(board.today).toBe('2026-11-25');
    expect(board.summary.occupied).toBe(1);
    expect(board.summary.guests).toEqual({ male: 1, female: 1, children: 0, total: 2 });
    const room = board.floors[0]?.rooms[0];
    expect(room?.state).toBe('OCCUPIED');
    expect(room?.current?.plannedCheckOutAt).toBe('2026-11-28T07:00:00.000Z');
    // Only this branch's active rooms are read.
    expect(prisma.hotelRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: 'org-karam', active: true, floor: { branchId: 'branch-main' } },
      }),
    );
  });
});
