import { crossedReorderLevel, needsReorder } from './purchasing';

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

describe('falling through the reorder level', () => {
  it('announces the moment stock drops to the level or below', () => {
    expect(crossedReorderLevel('12', '4', '5')).toBe(true);
    expect(crossedReorderLevel('5.0001', '5', '5')).toBe(true);
    expect(crossedReorderLevel('12', '0', '5')).toBe(true);
  });

  it('stays quiet while stock is already low, so nobody is told twice', () => {
    expect(crossedReorderLevel('4', '2', '5')).toBe(false);
    expect(crossedReorderLevel('5', '3', '5')).toBe(false);
  });

  it('stays quiet while stock is still above the level', () => {
    expect(crossedReorderLevel('20', '12', '5')).toBe(false);
  });

  it('stays quiet when stock went up, and when no level is set', () => {
    expect(crossedReorderLevel('3', '30', '5')).toBe(false);
    expect(crossedReorderLevel('10', '0', '0')).toBe(false);
  });

  it('announces again after a restock lifted stock above the level', () => {
    expect(crossedReorderLevel('4', '30', '5')).toBe(false);
    expect(crossedReorderLevel('30', '4', '5')).toBe(true);
  });
});
