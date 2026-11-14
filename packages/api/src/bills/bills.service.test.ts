import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { BillFiles } from './bill-files';
import { BillsService } from './bills.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-1',
  branchId: 'branch-1',
};

const billFile = {
  buffer: Buffer.from('bill'),
  mimetype: 'image/jpeg',
  size: 4,
  originalname: 'market.jpg',
};

const input = {
  supplierId: 'sup-1',
  billNumber: 'K-19',
  billedOn: '2026-11-13',
  locationId: 'loc-1',
  billTotal: '5000',
  lines: JSON.stringify([{ itemId: 'item-1', quantity: '1', unitPrice: '5000' }]),
};

function serviceFor(outer: object, tx: object = outer): { service: BillsService; files: BillFiles } {
  const files = {
    save: jest.fn().mockResolvedValue('org-1/file.jpg'),
    remove: jest.fn().mockResolvedValue(undefined),
    read: jest.fn(),
  } as unknown as BillFiles;
  const prisma = {
    ...outer,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return { service: new BillsService(prisma as never, new AuditService(), files), files };
}

describe('BillsService', () => {
  it('refuses an airline user', async () => {
    const { service } = serviceFor({});
    await expect(
      service.post({ ...actor, role: 'AIRLINE_REQUESTER' }, input, billFile),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('asks for a photo or PDF', async () => {
    const { service } = serviceFor({});
    await expect(service.post(actor, input, undefined)).rejects.toThrow('Choose a bill photo or PDF.');
  });

  it('refuses a total that the lines do not make', async () => {
    const { service, files } = serviceFor({});
    await expect(
      service.post(actor, { ...input, billTotal: '10' }, billFile),
    ).rejects.toThrow('The lines do not add up to the bill total.');
    expect(files.save).not.toHaveBeenCalled();
  });

  it('refuses a bill that is already on file', async () => {
    const { service, files } = serviceFor({
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'sup-1' }) },
      stockLocation: { findFirst: jest.fn().mockResolvedValue({ id: 'loc-1' }) },
      item: {
        findMany: jest.fn().mockResolvedValue([{ id: 'item-1', conversionToBase: new Prisma.Decimal('25') }]),
      },
      goodsReceipt: { findFirst: jest.fn().mockResolvedValue({ id: 'old' }) },
    });
    await expect(service.post(actor, input, billFile)).rejects.toBeInstanceOf(BadRequestException);
    expect(files.save).not.toHaveBeenCalled();
  });

  it('posts stock and a supplier payable', async () => {
    const layer = jest.fn().mockResolvedValue({ id: 'layer-1' });
    const movement = jest.fn().mockResolvedValue({ id: 'move-1' });
    const payable = jest.fn().mockResolvedValue({ id: 'pay-1' });
    const { service } = serviceFor(
      {
        supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'sup-1' }) },
        stockLocation: { findFirst: jest.fn().mockResolvedValue({ id: 'loc-1' }) },
        item: {
          findMany: jest.fn().mockResolvedValue([{ id: 'item-1', conversionToBase: new Prisma.Decimal('25') }]),
        },
        goodsReceipt: { findFirst: jest.fn().mockResolvedValue(null) },
      },
      {
        documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 3 }) },
        goodsReceipt: {
          create: jest.fn().mockImplementation(({ data }: { data: { lines: { create: Array<{ itemId: string; quantity: Prisma.Decimal; quantityBase: Prisma.Decimal; unitCost: Prisma.Decimal }> } } }) => ({
            id: 'gr-1',
            number: 'GR-00003',
            purchaseId: null,
            purchase: null,
            supplier: { name: 'Karachi Grain' },
            billNumber: 'K-19',
            billTotal: new Prisma.Decimal('5000'),
            billTax: new Prisma.Decimal('0'),
            billDiscount: new Prisma.Decimal('0'),
            billStoredAs: 'org-1/file.jpg',
            locationId: 'loc-1',
            location: { name: 'Dry store' },
            receivedOn: new Date('2026-11-13T00:00:00.000Z'),
            lines: data.lines.create.map((line, index) => ({
              id: `line-${index}`,
              itemId: line.itemId,
              quantity: line.quantity,
              quantityBase: line.quantityBase,
              unitCost: line.unitCost,
              item: { name: 'Wheat flour', purchaseUnit: 'bag', baseUnit: 'KG' },
            })),
          })),
        },
        stockLayer: { create: layer },
        stockMovement: { create: movement },
        supplierPayable: { create: payable },
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      },
    );

    const receipt = await service.post(actor, input, billFile);
    expect(receipt.number).toBe('GR-00003');
    expect(receipt.lines[0]?.quantityBase).toBe('25');
    expect(receipt.lines[0]?.unitCost).toBe('200');
    expect(layer).toHaveBeenCalled();
    expect(movement).toHaveBeenCalled();
    expect(payable).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: new Prisma.Decimal('5000'), receiptId: 'gr-1' }),
      }),
    );
  });
});
