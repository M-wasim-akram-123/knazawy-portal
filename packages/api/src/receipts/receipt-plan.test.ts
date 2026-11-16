import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { planReceipt } from './receipt-plan';

const decimal = (value: string) => new Prisma.Decimal(value);

const rice = {
  id: 'line-1',
  quantity: decimal('4'),
  receivedQuantity: decimal('0'),
  conversionToBase: decimal('25'),
  unitPrice: decimal('5000'),
};

describe('planReceipt', () => {
  it('opens a layer at the price of one base unit and leaves the rest on order', () => {
    const plan = planReceipt([rice], [{ purchaseLineId: 'line-1', quantity: decimal('1') }]);

    expect(plan.status).toBe('PART_RECEIVED');
    expect(plan.lines[0]?.quantityBase.toString()).toBe('25');
    expect(plan.lines[0]?.unitCost.toString()).toBe('200');
    expect(plan.lines[0]?.receivedQuantity.toString()).toBe('1');
  });

  it('marks the purchase received when every ordered unit has arrived', () => {
    const plan = planReceipt(
      [{ ...rice, receivedQuantity: decimal('1') }],
      [{ purchaseLineId: 'line-1', quantity: decimal('3') }],
    );

    expect(plan.status).toBe('RECEIVED');
    expect(plan.lines[0]?.quantityBase.toString()).toBe('75');
  });

  it('refuses a quantity above what is still on order', () => {
    expect(() =>
      planReceipt([rice], [{ purchaseLineId: 'line-1', quantity: decimal('5') }]),
    ).toThrow(BadRequestException);
  });
});
