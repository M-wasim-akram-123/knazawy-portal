import { needsReorder } from './purchasing';

describe('reorder level', () => {
  it('flags stock at or below the reorder level, including none left', () => {
    expect(needsReorder('4.5000', '5')).toBe(true);
    expect(needsReorder('5', '5.000')).toBe(true);
    expect(needsReorder('0', '2')).toBe(true);
  });

  it('leaves stock above the level, and items with no level set', () => {
    expect(needsReorder('5.0001', '5')).toBe(false);
    expect(needsReorder('0', '0')).toBe(false);
    expect(needsReorder('abc', '5')).toBe(false);
  });
});
