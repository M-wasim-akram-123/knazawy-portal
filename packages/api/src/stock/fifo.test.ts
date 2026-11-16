import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { drawFifo } from './fifo';

const names = { item: 'Wheat flour', location: 'Dry store', unit: 'kg' };

describe('drawFifo', () => {
  it('takes from the oldest layer first and leaves the newer layer whole', () => {
    const result = drawFifo(
      [
        { id: 'old', quantityBase: new Prisma.Decimal('25'), unitCost: new Prisma.Decimal('200') },
        { id: 'new', quantityBase: new Prisma.Decimal('25'), unitCost: new Prisma.Decimal('220') },
      ],
      new Prisma.Decimal('30'),
      names,
    );

    expect(result.draws.map((draw) => [draw.layerId, draw.quantityBase.toString()])).toEqual([
      ['old', '25'],
      ['new', '5'],
    ]);
    expect(result.cost.toString()).toBe('6100');
  });

  it('refuses more than is in the location and says how much there is', () => {
    expect(() =>
      drawFifo(
        [{ id: 'old', quantityBase: new Prisma.Decimal('25'), unitCost: new Prisma.Decimal('200') }],
        new Prisma.Decimal('30'),
        names,
      ),
    ).toThrow(new BadRequestException('Only 25 kg of Wheat flour is in Dry store.'));
  });

  it('rounds each draw cost to paisa', () => {
    const result = drawFifo(
      [{ id: 'one', quantityBase: new Prisma.Decimal('10'), unitCost: new Prisma.Decimal('33.3333') }],
      new Prisma.Decimal('1.5'),
      names,
    );
    expect(result.cost.toString()).toBe('50');
  });
});
