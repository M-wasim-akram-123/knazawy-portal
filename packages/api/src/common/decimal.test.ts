import { BadRequestException } from '@nestjs/common';

import { parseNonNegativeDecimal, parsePositiveDecimal } from './decimal';

describe('decimals', () => {
  it('accepts a positive conversion and a zero reorder level', () => {
    expect(parsePositiveDecimal('25', 'conversion').toString()).toBe('25');
    expect(parseNonNegativeDecimal('0', 'reorder').toString()).toBe('0');
  });

  it('rejects zero, blanks, and letters for a conversion', () => {
    expect(() => parsePositiveDecimal('0', 'Enter a conversion above zero.')).toThrow(
      BadRequestException,
    );
    expect(() => parsePositiveDecimal('abc', 'Enter a conversion above zero.')).toThrow(
      BadRequestException,
    );
  });
});
