import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { crossings } from '../src/world/road-signs.js';
import { speedLimitAt } from '../src/sim/law.js';
import { drawRoadSign } from '../src/world/sprites.js';
import { COLOURS, WORLD, ROAD_SIGNS } from '../src/config.js';

const T = WORLD.tileMetres;
const world = new World(buildKigaliMap());

describe('road signs and zebra crossings', () => {
  it('puts many speed limit signs on the map, with the limit of the road where they stand', () => {
    const limits = world.signs.filter((s) => s.kind === 'limit');
    expect(limits.length).toBeGreaterThan(100);
    for (const s of limits.slice(0, 40)) {
      const near = [[0, 0.8], [0, -0.8], [0.8, 0], [-0.8, 0]].map(([dx, dy]) => speedLimitAt(world, (s.x + dx) * T, (s.y + dy) * T).limitKmh);
      expect(near).toContain(s.limitKmh);
    }
  });

  it('signs stand beside the road, not on it or in a building, and they are poles you can hit', () => {
    for (const s of world.signs.filter((s) => s.kind)) {
      const t = world.tile(Math.floor(s.x), Math.floor(s.y));
      expect(t.block).toBeFalsy();
      expect(world.poles.some((p) => Math.abs(p.x - s.x * T) < 1e-6 && Math.abs(p.y - s.y * T) < 1e-6)).toBe(true);
    }
  });

  it('a warning sign stands before each speed bump, and a crossing sign at each crossing', () => {
    expect(world.signs.filter((s) => s.kind === 'bump').length).toBeGreaterThan(5);
    expect(world.signs.filter((s) => s.kind === 'crossing').length).toBeGreaterThan(20);
  });

  it('zebra crossings are on tarmac next to a junction, and never on a speed bump', () => {
    const cross = crossings(world);
    expect(cross.size).toBeGreaterThan(40);
    for (const key of cross.keys()) {
      const [x, y] = key.split(',').map(Number);
      const t = world.tile(x, y);
      expect(t.surface).toBe('tarmac');
      expect(t.hazard).toBeFalsy();
    }
    expect(ROAD_SIGNS.crossingChance).toBeLessThan(1);
  });

  it('draws the bump and crossing signs (red triangle, blue square), not in Surge Yellow', () => {
    const has = (c, rgb) => { for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3] && ((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]) === rgb) return true; return false; };
    expect(has(drawRoadSign('bump'), 0xd0302a)).toBe(true);
    expect(has(drawRoadSign('crossing'), 0x1f5fb0)).toBe(true);
    expect(has(drawRoadSign('bump'), COLOURS.ampersandYellow)).toBe(false);
  });
});
