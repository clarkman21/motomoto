import { describe, it, expect } from 'vitest';
import { RIDER_LINES, createLineBags, nextLines } from '../src/sim/rider-lines.js';
import { RETRO_CHARS } from '../src/world/retro-font.js';
import { RIDER } from '../src/config.js';
import { mulberry32 } from '../src/sim/jobs.js';

// What the rider says in a bubble: food, crashes, Maria (sim/rider-lines.js).

describe('the rider lines', () => {
  it('has lines for each food, for crashes, slips, officers and Maria (the speed camera)', () => {
    for (const food of Object.keys(RIDER.foods)) expect(RIDER_LINES[food]?.length).toBeGreaterThan(2);
    for (const kind of ['crash', 'slip', 'officer', 'camera']) expect(RIDER_LINES[kind]?.length).toBeGreaterThan(1);
    expect(RIDER_LINES.camera.join(' ')).toContain('MARIA');
  });

  it('a line does not come again before all the others of its kind', () => {
    const bags = createLineBags(), rng = mulberry32(7);
    const n = RIDER_LINES.crash.length;
    const seen = new Set(Array.from({ length: n }, () => nextLines(bags, 'crash', rng).join('|')));
    expect(seen.size).toBe(n);
    expect(nextLines(bags, 'crash', rng).length).toBeGreaterThan(0); // the bag fills again
    expect(nextLines(bags, 'nothing', rng)).toEqual([]);
  });

  it('every line is short, in capitals, and uses only letters of the bubble font', () => {
    for (const entry of Object.values(RIDER_LINES).flat()) {
      for (const line of Array.isArray(entry) ? entry : [entry]) {
        expect(line.length, line).toBeLessThanOrEqual(40);
        for (const ch of line) expect(RETRO_CHARS, line).toContain(ch);
      }
    }
  });
});
