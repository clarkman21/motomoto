import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { policeSpots, drawOfficer, drawPolicePost } from '../src/world/police.js';
import { VEST } from '../src/world/sprites.js';
import { WORLD, COLOURS } from '../src/config.js';

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

  it('wear a police vest (not the yellow vest of the moto riders) over a dark blue uniform, and a white cap', () => {
    const count = (c, colour) => {
      let n = 0;
      for (let i = 0; i < c.data.length; i += 4) if (((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]) === colour) n++;
      return n;
    };
    for (const f of [0, 1, 2, 3]) {
      const c = drawOfficer(f);
      expect(count(c, COLOURS.policeVest)).toBeGreaterThan(8);
      expect(count(c, COLOURS.policeBlue)).toBeGreaterThan(3); // the blue and white checks
      expect(count(c, 0x1c2a5a)).toBeGreaterThan(10);
      expect(count(c, 0xf4f4f4)).toBeGreaterThan(5); // the cap, the gloves, the belt
      expect(count(c, VEST.colour)).toBe(0);
    }
    expect(COLOURS.policeVest).not.toBe(VEST.colour);
  });

  it('have a blue POLICE post with a light that flashes blue and red', () => {
    const blue = drawPolicePost(0), red = drawPolicePost(1);
    expect(Buffer.from(blue.data).equals(Buffer.from(red.data))).toBe(false);
    let n = 0;
    for (let i = 0; i < blue.data.length; i += 4) if (((blue.data[i] << 16) | (blue.data[i + 1] << 8) | blue.data[i + 2]) === COLOURS.policeBlue) n++;
    expect(n).toBeGreaterThan(60);
  });

  it('most spots have a post near the officer', () => {
    const spots = policeSpots(world, graph);
    const posts = spots.filter((s) => s.post);
    expect(posts.length).toBeGreaterThan(spots.length * 0.6);
    for (const s of posts) expect(Math.hypot(s.post.x - s.x, s.post.y - s.y)).toBeLessThan(T);
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

describe('police go around buildings', async () => {
  const { createPolice, stepPolice, findPath, clearLine } = await import('../src/sim/police.js');
  const T = WORLD.tileMetres;
  // A wall of solid tiles at x = 5 (tiles), from y = 0 to y = 8, with a gap below it.
  const isSolid = (x, y) => Math.floor(x / T) === 5 && Math.floor(y / T) <= 8;

  it('finds a path around a wall, and the line through the wall is not clear', () => {
    const a = { x: 2 * T, y: 4 * T }, b = { x: 9 * T, y: 4 * T };
    expect(clearLine(a, b, isSolid)).toBe(false);
    const path = findPath(a, b, isSolid);
    expect(path).not.toBeNull();
    for (const p of path) expect(isSolid(p.x, p.y)).toBe(false);
    expect(path.some((p) => p.y / T > 8.5)).toBe(true); // it goes through the gap
  });

  it('a chasing officer runs around the wall and catches the bike', () => {
    const police = createPolice([{ x: 2 * T, y: 4 * T, phase: 0 }]);
    const bike = { x: 3 * T, y: 4 * T };
    stepPolice(police, bike, { speedKmh: 10, limitKmh: 30, illegal: 'pavement' }, 0.1, isSolid);
    expect(police.officers[0].state).toBe('chase');
    // The bike stops behind the wall.
    bike.x = 8 * T;
    bike.y = 4 * T;
    let caught = false;
    for (let t = 0; t < 12 && !caught; t += 0.05) caught = stepPolice(police, bike, { speedKmh: 0, limitKmh: 30, illegal: null }, 0.05, isSolid).some((e) => e.type === 'caught');
    const o = police.officers[0];
    expect(isSolid(o.x, o.y)).toBe(false);
    expect(caught).toBe(true);
  });
});
