import { describe, it, expect } from 'vitest';
import { crashWearShare, hitWearKm } from '../src/sim/maintenance.js';
import { MAINTENANCE as M, COLLISION } from '../src/config.js';

describe('a crash fills the service meter (Alp)', () => {
  it('a harder crash fills more, up to the max; the same share for petrol and electric', () => {
    const slow = crashWearShare((COLLISION.crashSpeedKmh + 1) / 3.6), fast = crashWearShare(60 / 3.6);
    expect(slow).toBeGreaterThanOrEqual(M.crashWear.base);
    expect(fast).toBeGreaterThan(slow);
    expect(crashWearShare(200 / 3.6)).toBe(M.crashWear.max);
    for (const type of ['petrol', 'electric']) {
      expect(hitWearKm({ type: 'crash', speed: 60 / 3.6 }, type) / M.intervalKm[type]).toBeCloseTo(fast);
    }
  });
});
