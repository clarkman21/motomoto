import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { drawBlock } from '../src/world/sprites.js';
import { drawCabinet } from '../src/world/cabinet-sprites.js';
import { drawAttendant } from '../src/world/attendant-sprites.js';
import { COLOURS } from '../src/config.js';

// The swap stations from the design canvas "Ampersand swap stations": 20 ft and 40 ft containers, swap
// cabinets, and the station staff in yellow and blue.

const world = new World(buildKigaliMap());
const T = 4;
const colours = (canvas) => {
  const set = new Set();
  for (let i = 0; i < canvas.data.length; i += 4) if (canvas.data[i + 3]) set.add((canvas.data[i] << 16) | (canvas.data[i + 1] << 8) | canvas.data[i + 2]);
  return set;
};

describe('swap stations', () => {
  it('the Nyabugogo hub is a 40 ft container on 3 tiles; the other stations are 20 ft on 2 tiles', () => {
    const hub = world.placesWithTag('swap').find((p) => p.name.includes('hub'));
    expect(hub).toBeTruthy();
    const hubTiles = world.blocks.filter((b) => b.kind === 'swap' && b.ty === 14 && b.tx >= 37 && b.tx <= 39);
    expect(hubTiles).toHaveLength(3);
    expect(world.blocks.filter((b) => b.kind === 'swap')).toHaveLength(3 + 5 * 2); // the hub and five 20 ft containers (one at the HQ)
  });

  it('a container is Surge Yellow with the black name, batteries and charge lights that glow at night', () => {
    const b = world.blocks.find((k) => k.kind === 'swap' && k.tx === 34 && k.ty === 98);
    const { canvas, glow } = drawBlock(b, world);
    const cols = colours(canvas);
    expect(cols.has(0x000000)).toBe(true); // the letters and the battery tops
    expect([...cols].some((c) => (c >> 16) > 200 && ((c >> 8) & 255) > 170 && (c & 255) < 40)).toBe(true); // yellow
    expect(glow).toBeTruthy();
    const lit = colours(glow);
    expect(lit.has(COLOURS.chargeGreen)).toBe(true);
  });

  it('three swap cabinets stand beside fuel stations: off the road, with the stop point on the road', () => {
    const cabs = world.placesWithTag('swap').filter((p) => p.cabinet);
    expect(cabs).toHaveLength(3);
    for (const p of cabs) {
      const at = world.tileAt(p.cabinet.x * T, p.cabinet.y * T);
      expect(at.block, p.name).toBeFalsy();
      expect(world.isSolidAt(p.cabinet.x * T, p.cabinet.y * T, false)).toBe(false);
      const stop = world.tileAt(p.x * T, p.y * T);
      expect(['tarmac', 'cobble', 'murram'], p.name).toContain(stop.surface);
      // A fuel station is near (the cabinet stands beside it).
      expect(world.placesWithTag('fuel').some((f) => Math.hypot(f.x - p.x, f.y - p.y) < 3), p.name).toBe(true);
    }
  });

  it('a cabinet opens two doors, and two batteries come out', () => {
    const closed = drawCabinet('closed'), open = drawCabinet('open');
    expect(open.canvas.width).toBe(closed.canvas.width);
    let diff = 0;
    for (let i = 0; i < open.canvas.data.length; i += 4) if (open.canvas.data[i] !== closed.canvas.data[i]) diff++;
    expect(diff).toBeGreaterThan(10);
    expect(colours(closed.canvas).has(COLOURS.ampersandYellow)).toBe(true);
    expect(colours(closed.canvas).has(COLOURS.chargeGreen)).toBe(true);
  });

  it('the station attendant wears a yellow shirt and blue trousers and cap', () => {
    const cols = colours(drawAttendant('swap', 'walk0'));
    expect([...cols].some((c) => c === COLOURS.ampersandYellow || ((c >> 16) > 200 && ((c >> 8) & 255) > 170 && (c & 255) < 40))).toBe(true);
    expect([...cols].some((c) => (c & 255) > 100 && (c >> 16) < 80)).toBe(true); // blue
  });
});
