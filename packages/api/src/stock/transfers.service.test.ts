import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { TransfersService } from './transfers.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-1',
};

const input = {
  fromLocationId: 'store',
  toLocationId: 'kitchen',
  sentOn: '2026-11-13',
  lines: [{ itemId: 'item-1', quantity: '30' }],
};

const saved = {
  id: 'tr-1',
  number: 'TR-00001',
  fromLocationId: 'store',
  fromLocation: { name: 'Dry store' },
  toLocationId: 'kitchen',
  toLocation: { name: 'Kitchen' },
  status: 'SENT' as const,
  sentOn: new Date('2026-11-13T00:00:00.000Z'),
  receivedOn: null,
  lines: [
    {
      item: { name: 'Wheat flour', baseUnit: 'KG' },
      quantityBase: new Prisma.Decimal('30'),
      cost: new Prisma.Decimal('6100'),
    },
  ],
};

function serviceFor(tx: Record<string, unknown>): TransfersService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new TransfersService(prisma as never, new AuditService());
}

describe('TransfersService', () => {
  it('refuses an airline user and a transfer into the same location', async () => {
    const service = serviceFor({});
    await expect(
      service.create({ ...actor, role: 'AIRLINE_REQUESTER' }, input),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create(actor, { ...input, toLocationId: 'store' }),
    ).rejects.toThrow('Choose two different locations.');
  });

  it('takes the oldest flour first and leaves it on the way', async () => {
    const movement = jest.fn().mockResolvedValue({ id: 'move-1' });
    const tx = {
      stockLocation: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === 'store' ? { id: 'store', name: 'Dry store' } : { id: 'kitchen', name: 'Kitchen' }),
        ),
      },
      item: {
        findMany: jest.fn().mockResolvedValue([{ id: 'item-1', name: 'Wheat flour', baseUnit: 'KG' }]),
      },
      documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
      stockTransfer: {
        create: jest.fn().mockResolvedValue({ id: 'tr-1' }),
        findUnique: jest.fn().mockResolvedValue(saved),
      },
      stockTransferLine: { create: jest.fn().mockResolvedValue({ id: 'line-1' }) },
      stockTransferDraw: { create: jest.fn().mockResolvedValue({ id: 'draw-1' }) },
      stockLayer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'old',
            quantityBase: new Prisma.Decimal('25'),
            unitCost: new Prisma.Decimal('200'),
            receivedOn: new Date('2026-11-01T00:00:00.000Z'),
          },
          {
            id: 'new',
            quantityBase: new Prisma.Decimal('90'),
            unitCost: new Prisma.Decimal('220'),
            receivedOn: new Date('2026-11-13T00:00:00.000Z'),
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: { create: movement },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const receipt = await serviceFor(tx).create(actor, input);

    expect(receipt.status).toBe('SENT');
    expect(receipt.number).toBe('TR-00001');
    expect(tx.stockTransferLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cost: new Prisma.Decimal('6100') }),
    });
    expect(tx.stockLayer.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'old', quantityBase: { gte: new Prisma.Decimal('25') } },
      data: { quantityBase: { decrement: new Prisma.Decimal('25') } },
    });
    const movements = movement.mock.calls.map(
      (call: [{ data: { type: string; quantityBase: Prisma.Decimal } }]) => [
        call[0].data.type,
        call[0].data.quantityBase.toString(),
      ],
    );
    expect(movements).toEqual([
      ['TRANSFER_OUT', '-25'],
      ['TRANSFER_OUT', '-5'],
    ]);
  });

  it('opens the same cost at the destination when the transfer is received', async () => {
    const layer = jest.fn().mockResolvedValue({ id: 'dest-layer' });
    const tx = {
      stockTransfer: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tr-1',
          status: 'SENT',
          toLocationId: 'kitchen',
          lines: [
            {
              itemId: 'item-1',
              draws: [
                {
                  id: 'draw-1',
                  quantityBase: new Prisma.Decimal('25'),
                  unitCost: new Prisma.Decimal('200'),
                  receivedOn: new Date('2026-11-01T00:00:00.000Z'),
                },
              ],
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          ...saved,
          status: 'RECEIVED',
          receivedOn: new Date('2026-11-14T00:00:00.000Z'),
        }),
      },
      stockLocation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'kitchen', name: 'Kitchen' }),
      },
      stockLayer: { create: layer },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'move-in' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };

    const result = await serviceFor(tx).receive(actor, 'tr-1', { receivedOn: '2026-11-14' });

    expect(result.status).toBe('RECEIVED');
    expect(layer).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locationId: 'kitchen',
        transferDrawId: 'draw-1',
        quantityBase: new Prisma.Decimal('25'),
        unitCost: new Prisma.Decimal('200'),
      }),
    });
  });

  it('refuses to receive a transfer twice', async () => {
    const tx = {
      stockTransfer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tr-1', status: 'RECEIVED', lines: [] }),
      },
      stockLayer: { create: jest.fn() },
    };
    await expect(serviceFor(tx).receive(actor, 'tr-1', { receivedOn: '2026-11-14' })).rejects.toThrow(
      new BadRequestException('This transfer has already been received.'),
    );
    expect(tx.stockLayer.create).not.toHaveBeenCalled();
  });
});
