import { parentCreatesCycle } from './location-tree';

describe('parentCreatesCycle', () => {
  it('rejects a parent chain that comes back to the location', () => {
    expect(parentCreatesCycle('cold-room', ['bin', 'cold-room'])).toBe(true);
    expect(parentCreatesCycle('cold-room', ['store'])).toBe(false);
  });
});
