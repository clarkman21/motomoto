import { describe, it, expect } from 'vitest';
import { HAZARDS } from '../src/config.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { createBike, stepBike, forwardSpeed } from '../src/sim/bike.js';
import { renderTerrain } from '../src/world/terrain-render.js';

const DT = 1 / 60;
const run = (bike, world, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...stepBike(bike, { steer: 0, throttle: 0, brake: 0 }, world, DT));
  return events;
};
// A murram road along +x with one rough tile at x = 3.
const road = (type) => new World({
  name: 'murram', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['m'.repeat(20), 'm'.repeat(20), 'm'.repeat(20)], hills: [],
  hazards: type ? [{ x: 3, y: 1, type }] : [],
});

describe('rough murram', () => {
  it('the Kigali murram has loose rocks and potholes, never on tarmac', () => {
    const world = new World(buildKigaliMap());
    const rough = world.tiles.filter((t) => t.hazard === 'rocks' || (t.hazard === 'pothole' && t.surface === 'murram'));
    expect(rough.filter((t) => t.hazard === 'rocks').length).toBeGreaterThan(40);
    expect(rough.filter((t) => t.hazard === 'pothole').length).toBeGreaterThan(15);
    expect(world.tiles.some((t) => t.hazard === 'rocks' && t.surface !== 'murram')).toBe(false);
  });

  it('loose rocks slow you down only when you ride fast', () => {
    const fast = createBike(road('rocks'));
    fast.vx = 12; // 43 km/h
    const ev = run(fast, road('rocks'), 0.6);
    expect(ev.some((e) => e.type === 'rocksHard')).toBe(true);
    const slow = createBike(road('rocks'));
    slow.vx = 5; // 18 km/h
    expect(run(slow, road('rocks'), 1.2).some((e) => e.type === 'rocksHard')).toBe(false);
    expect(HAZARDS.rocks.speedCut).toBeGreaterThan(0);
  });

  it('a murram pothole is a puddle on a rainy day', () => {
    const dry = road('pothole');
    const b1 = createBike(dry);
    b1.vx = 10;
    expect(run(b1, dry, 0.8).some((e) => e.type === 'pothole')).toBe(true);
    const wet = road('pothole');
    wet.rain = true;
    const b2 = createBike(wet);
    b2.vx = 10;
    expect(run(b2, wet, 0.8).some((e) => e.type === 'puddle')).toBe(true);
    expect(forwardSpeed(b2)).toBeLessThan(10 * (1 - HAZARDS.pothole.speedCut) + 0.3);
  });

  it('the bike bumps up and down on murram at speed (a washboard)', () => {
    const world = road(null);
    const bike = createBike(world);
    bike.vx = 9;
    let bumps = 0;
    for (let t = 0; t < 1; t += DT) {
      const before = bike.bump;
      stepBike(bike, { steer: 0, throttle: 0.6, brake: 0 }, world, DT);
      if (bike.bump > before) bumps++;
    }
    expect(bumps).toBeGreaterThan(1);
  });

  it('wet murram looks darker and has puddles', () => {
    const world = road('pothole');
    const blue = (c) => { let n = 0; for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3] && c.data[i + 2] > c.data[i]) n++; return n; };
    const dry = renderTerrain(world, { tx0: 0, ty0: 0, tx1: 8, ty1: 3 });
    world.rain = true;
    const wet = renderTerrain(world, { tx0: 0, ty0: 0, tx1: 8, ty1: 3 });
    expect(blue(wet)).toBeGreaterThan(blue(dry) + 50);
  });
});
