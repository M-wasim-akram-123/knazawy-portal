import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import { RoomSetupService } from './room-setup.service';

const admin = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-karam',
  branchId: 'branch-main',
};

const operations = {
  id: 'user-3',
  email: 'ops@karam.local',
  name: 'Operations',
  role: 'OPERATIONS_MANAGER' as const,
  organisationId: 'org-karam',
};

function serviceFor(tx: Record<string, unknown>): RoomSetupService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new RoomSetupService(prisma as never, new AuditService());
}

describe('RoomSetupService', () => {
  it('refuses operations adding a floor', async () => {
    const service = serviceFor({});
    await expect(service.createFloor(operations, { name: 'Ground' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('adds a floor the administrator named', async () => {
    const mocks = {
      roomFloor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'floor-1',
          name: 'Ground',
          sortOrder: 0,
          active: true,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    const created = await service.createFloor(admin, { name: '  Ground  ' });
    expect(created.name).toBe('Ground');
    expect(mocks.roomFloor.create).toHaveBeenCalledWith({
      data: { organisationId: 'org-karam', branchId: 'branch-main', name: 'Ground', sortOrder: 0 },
    });
  });

  it('will not archive a floor that still has a room', async () => {
    const mocks = {
      roomFloor: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'floor-1',
          name: 'Ground',
          sortOrder: 0,
          active: true,
        }),
      },
      hotelRoom: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = serviceFor(mocks);
    await expect(service.updateFloor(admin, 'floor-1', { active: false })).rejects.toThrow(
      'Archive the rooms on this floor first.',
    );
  });

  it('adds a named charge and totals the active ones per night', async () => {
    const roomType = {
      id: 'type-1',
      organisationId: 'org-karam',
      name: 'Deluxe',
      note: null,
      active: true,
      charges: [],
    };
    const withCharge = {
      ...roomType,
      charges: [
        {
          id: 'charge-1',
          name: 'Room',
          amountPerNight: { toFixed: () => '8000.00' },
          active: true,
        },
      ],
    };
    const mocks = {
      roomType: {
        findFirst: jest.fn().mockResolvedValue(roomType),
        findUnique: jest.fn().mockResolvedValue(withCharge),
      },
      roomCharge: { create: jest.fn().mockResolvedValue({ id: 'charge-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    const updated = await service.addCharge(admin, 'type-1', {
      name: 'Room',
      amountPerNight: '8000',
    });
    expect(updated.nightlyTotal).toBe('8000.00');
    expect(updated.charges[0]?.name).toBe('Room');
  });

  it('refuses a charge that is not an amount', async () => {
    const mocks = {
      roomType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          charges: [],
          active: true,
        }),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.addCharge(admin, 'type-1', { name: 'Room', amountPerNight: 'eight' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('archiving or moving a room', () => {
    const room = {
      id: 'room-1',
      organisationId: 'org-karam',
      name: '101',
      floorId: 'floor-1',
      roomTypeId: 'type-1',
      active: true,
      floor: { name: 'Ground' },
      roomType: { name: 'Single' },
    };
    const acceptedTwoRooms = [
      {
        quantity: 2,
        request: {
          checkIn: new Date('2099-01-10T00:00:00.000Z'),
          checkOut: new Date('2099-01-12T00:00:00.000Z'),
        },
      },
    ];

    function roomMocks(overrides: Record<string, unknown>) {
      return {
        hotelRoom: {
          findFirst: jest.fn().mockResolvedValue(room),
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn().mockResolvedValue({ ...room, active: false }),
        },
        roomStay: { count: jest.fn().mockResolvedValue(0) },
        roomRequestLine: { findMany: jest.fn().mockResolvedValue([]) },
        $queryRaw: jest.fn().mockResolvedValue([]),
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        ...overrides,
      };
    }

    it('refuses while a guest is in the room', async () => {
      const mocks = roomMocks({ roomStay: { count: jest.fn().mockResolvedValue(1) } });
      const service = serviceFor(mocks);
      await expect(service.updateRoom(admin, 'room-1', { active: false })).rejects.toThrow(
        'A guest is in this room. Check them out first.',
      );
      expect(mocks.hotelRoom.update).not.toHaveBeenCalled();
    });

    it('refuses when accepted stays would be left short of rooms of that type', async () => {
      const mocks = roomMocks({
        hotelRoom: {
          findFirst: jest.fn().mockResolvedValue(room),
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn(),
        },
        roomRequestLine: { findMany: jest.fn().mockResolvedValue(acceptedTwoRooms) },
      });
      const service = serviceFor(mocks);
      await expect(service.updateRoom(admin, 'room-1', { active: false })).rejects.toThrow(
        'Accepted stays need 2 Single rooms. Keep this room, or move those stays first.',
      );
      expect(mocks.hotelRoom.update).not.toHaveBeenCalled();
    });

    it('archives the room when the stays still fit without it', async () => {
      const mocks = roomMocks({
        hotelRoom: {
          findFirst: jest.fn().mockResolvedValue(room),
          count: jest.fn().mockResolvedValue(2),
          update: jest.fn().mockResolvedValue({ ...room, active: false }),
        },
        roomRequestLine: { findMany: jest.fn().mockResolvedValue(acceptedTwoRooms) },
      });
      const service = serviceFor(mocks);
      await service.updateRoom(admin, 'room-1', { active: false });
      expect(mocks.hotelRoom.update).toHaveBeenCalled();
      expect(mocks.$queryRaw).toHaveBeenCalled();
    });
  });

  it('keeps a room name unique on its floor', async () => {
    const mocks = {
      roomFloor: {
        findFirst: jest.fn().mockResolvedValue({ id: 'floor-1', active: true }),
      },
      roomType: {
        findFirst: jest.fn().mockResolvedValue({ id: 'type-1', active: true, charges: [] }),
      },
      hotelRoom: {
        findFirst: jest.fn().mockResolvedValue({ id: 'room-1' }),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.createRoom(admin, { floorId: 'floor-1', roomTypeId: 'type-1', name: '101' }),
    ).rejects.toThrow('That room name is already used on this floor.');
  });
});
