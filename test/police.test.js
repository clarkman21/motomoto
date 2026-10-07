import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { policeSpots, drawOfficer } from '../src/world/police.js';
import { VEST } from '../src/world/sprites.js';
import { WORLD } from '../src/config.js';

const T = WORLD.tileMetres;
const world = new World(buildKigaliMap());
const graph = buildRoadGraph(world.roads);

describe('traffic police', () => {
  const spots = policeSpots(world, graph);

  it('stand on the corners of most junctions, in every district, off the road', () => {
    const junctions = graph.nodes.filter((n) => new Set(n.out.map((e) => `${Math.round(e.dx)},${Math.round(e.dy)}`)).size >= 3);
    expect(spots.length).toBeGreaterThan(junctions.length * 0.5);
    expect(new Set(spots.map((s) => world.tileAt(s.x, s.y).district)).size).toBe(6);
    for (const s of spots) {
      const t = world.tileAt(s.x, s.y);
      expect(['pavement', 'grass']).toContain(t.surface);
      expect(t.block).toBeNull();
      // Close to a junction (within 3 tiles of a node with 3 or more ways).
      expect(junctions.some((n) => Math.hypot(n.x - s.x, n.y - s.y) < 3 * T)).toBe(true);
    }
  });

  it('wear a high visibility vest over a dark blue uniform', () => {
    const c = drawOfficer(1);
    let vest = 0, blue = 0;
    for (let i = 0; i < c.data.length; i += 4) {
      const rgb = (c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2];
      if (rgb === VEST.colour) vest++;
      if (rgb === 0x1c2a5a) blue++;
    }
    expect(vest).toBeGreaterThan(10);
    expect(blue).toBeGreaterThan(10);
  });
});

describe('police chase', async () => {
  const { createPolice, stepPolice } = await import('../src/sim/police.js');
  const { POLICE } = await import('../src/config.js');
  const ctx = (illegal, speedKmh = 20) => ({ speedKmh, limitKmh: 40, illegal });

  it('an officer who sees you on the pavement runs after you; you pay if you stay', () => {
    const police = createPolice([{ x: 0, y: 0, phase: 0 }]);
    const bike = { x: 10, y: 0 };
    const start = stepPolice(police, bike, ctx('pavement'), 0.1);
    expect(start.map((e) => e.type)).toEqual(['chase']);
    let caught = null;
    for (let t = 0; t < 5 && !caught; t += 0.1) caught = stepPolice(police, bike, ctx(null, 0), 0.1).find((e) => e.type === 'caught');
    expect(caught.reason).toBe('pavement');
    expect(police.officers[0].state).toBe('return');
    // A cooldown: no new chase at once.
    expect(stepPolice(police, bike, ctx('offRoad'), 0.1).some((e) => e.type === 'chase')).toBe(false);
  });

  it('you get away if you ride faster than the officer runs', () => {
    const police = createPolice([{ x: 0, y: 0, phase: 0 }]);
    const bike = { x: 10, y: 0 };
    stepPolice(police, bike, ctx('offRoad'), 0.1);
    let end = null;
    for (let t = 0; t < 20 && !end; t += 0.1) {
      bike.x += (40 / 3.6) * 0.1; // 40 km/h on the road
      end = stepPolice(police, bike, ctx(null, 40), 0.1).find((e) => e.type === 'escaped' || e.type === 'caught');
    }
    expect(end.type).toBe('escaped');
  });

  it('the officer runs fast: pushing the bike, you do not get away', () => {
    const police = createPolice([{ x: 0, y: 0, phase: 0 }]);
    const bike = { x: 10, y: 0 };
    stepPolice(police, bike, ctx('offRoad'), 0.1);
    let end = null;
    for (let t = 0; t < 20 && !end; t += 0.1) {
      bike.x += (4 / 3.6) * 0.1;
      end = stepPolice(police, bike, ctx(null, 4), 0.1).find((e) => e.type === 'escaped' || e.type === 'caught');
    }
    expect(end.type).toBe('caught');
    expect(POLICE.runKmh).toBeGreaterThan(15);
  });

  it('far away officers do not see you; speeding past one gives a whistle, not a chase', () => {
    const police = createPolice([{ x: 0, y: 0, phase: 0 }]);
    expect(stepPolice(police, { x: POLICE.seeMetres + 5, y: 0 }, ctx('pavement'), 0.1)).toHaveLength(0);
    const e = stepPolice(police, { x: 3, y: 0 }, ctx(null, 70), 0.1);
    expect(e.map((x) => x.type)).toEqual(['whistle']);
  });
});
