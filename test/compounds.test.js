import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { drawWallSegment, hitsWall, segmentEnds } from '../src/world/compounds.js';
import { offPalette } from '../src/world/palette.js';
import { GARDEN_WALLS, WORLD } from '../src/config.js';

const world = new World(buildKigaliMap());
const T = WORLD.tileMetres;

describe('garden walls around the villas', () => {
  it('walls only in the listed districts, only on grass, never on a road', () => {
    expect(world.walls.length).toBeGreaterThan(200);
    for (const s of world.walls) {
      const t = world.tile(s.tx, s.ty);
      expect(GARDEN_WALLS.districts).toContain(t.district);
      expect(t.surface).toBe('grass');
      expect(t.block).toBe(null);
    }
  });

  it('a compound has at most one gate, and most compounds have one', () => {
    const gates = new Map(), all = new Set();
    for (const s of world.walls) {
      all.add(s.compound);
      if (s.gate) gates.set(s.compound, (gates.get(s.compound) ?? 0) + 1);
    }
    for (const n of gates.values()) expect(n).toBe(1);
    expect(gates.size / all.size).toBeGreaterThan(0.8);
  });

  it('no job place is inside a wall tile', () => {
    for (const p of world.places) expect(world.wallIndex.has(Math.floor(p.x) + ',' + Math.floor(p.y))).toBe(false);
  });

  it('a wall is solid; the middle of its tile is not', () => {
    const s = world.walls.find((w) => w.edge === 'n');
    const [a, b] = segmentEnds(s);
    const mx = ((a.x + b.x) / 2) * T, my = a.y * T;
    expect(hitsWall(s, mx, my)).toBe(true);
    expect(world.isSolidAt(mx, my, false)).toBe(true);
    expect(hitsWall(s, mx, my + T / 2)).toBe(false);
  });

  it('the wall art uses only palette colours (with the light rule)', () => {
    for (const s of [world.walls.find((w) => w.gate && (w.edge === 'n' || w.edge === 's')), world.walls.find((w) => w.gate && (w.edge === 'e' || w.edge === 'w')), ...world.walls.slice(0, 20)]) {
      if (!s) continue;
      const { canvas, depth } = drawWallSegment(s, world);
      expect(offPalette(canvas)).toEqual([]);
      expect(depth).toBeGreaterThan(s.tx + s.ty - 0.01);
      expect(depth).toBeLessThan(s.tx + s.ty + 2.01);
    }
  });
});
