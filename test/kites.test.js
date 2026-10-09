import { describe, it, expect } from 'vitest';
import { KITES } from '../src/config.js';
import { createKites, stepKites, kitesVisible } from '../src/sim/kites.js';
import { drawKite } from '../src/world/kite-sprites.js';
import { mulberry32 } from '../src/sim/jobs.js';

describe('brown kites', () => {
  it('circle high near their market for a long time', () => {
    const kites = createKites([{ x: 200, y: 60 }, { x: 680, y: 410 }]);
    expect(kites).toHaveLength(KITES.count);
    const rng = mulberry32(2);
    for (let t = 0; t < 600; t += 0.1) stepKites(kites, 0.1, rng);
    for (const k of kites) {
      expect(Math.hypot(k.x - k.home.x, k.y - k.home.y)).toBeLessThan(250);
      expect(k.alt).toBeGreaterThanOrEqual(KITES.altitudeMetres[0]);
    }
  });

  it('fly by day, not at night, and fewer fly in the rain', () => {
    expect(kitesVisible(10, 1, false)).toBe(10);
    expect(kitesVisible(10, 0.1, false)).toBe(0);
    expect(kitesVisible(10, 1, true)).toBeLessThan(10);
  });

  it('a kite is brown, with a forked tail', () => {
    const c = drawKite('glide');
    const at = (x, y) => c.data[(y * c.width + x) * 4 + 3];
    expect(at(4, 6) && at(8, 6) && !at(6, 6)).toBeTruthy(); // the fork: two tips, a gap between
  });
});
