import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { ReceiptsService } from './receipts.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-1',
};

function serviceFor(tx: object): ReceiptsService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new ReceiptsService(prisma as never, new AuditService());
}

describe('ReceiptsService', () => {
  it('refuses goods before the purchase is sent', async () => {
    const service = serviceFor({
      purchase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'po-1',
          status: 'DRAFT',
          lines: [],
        }),
      },
    });

    await expect(
      service.create(actor, {
        purchaseId: 'po-1',
        locationId: 'loc-1',
        receivedOn: '2026-11-13',
        lines: [{ purchaseLineId: 'line-1', quantity: '1' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a receipt above the ordered quantity before it posts stock', async () => {
    const service = serviceFor({
      purchase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'po-1',
          status: 'SENT',
          lines: [
            {
              id: 'line-1',
              itemId: 'item-1',
              quantity: new Prisma.Decimal('2'),
              receivedQuantity: new Prisma.Decimal('0'),
              unitPrice: new Prisma.Decimal('5000'),
              item: { conversionToBase: new Prisma.Decimal('25') },
            },
          ],
        }),
      },
      stockLocation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'loc-1' }),
      },
    });

    await expect(
      service.create(actor, {
        purchaseId: 'po-1',
        locationId: 'loc-1',
        receivedOn: '2026-11-13',
        lines: [{ purchaseLineId: 'line-1', quantity: '3' }],
      }),
    ).rejects.toThrow('Receive no more than the quantity still on order.');
  });
});
