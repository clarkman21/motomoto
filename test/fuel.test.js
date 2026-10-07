import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { routeClimb, legFuel, jobFuel } from '../src/sim/fuel.js';
import { createBike, stepBike } from '../src/sim/bike.js';

const world = new World(buildKigaliMap());

describe('fuel estimate for a job', () => {
  it('counts the climb on the way: up to Kigali town, not down from it', () => {
    const valley = { x: 41, y: 40 }, town = { x: 41, y: 100 };
    expect(routeClimb(world, valley, town)).toBeGreaterThan(9);
    expect(routeClimb(world, town, valley)).toBeLessThan(1);
  });

  it('a heavier load, a climb and a longer trip need more fuel', () => {
    expect(legFuel('petrol', 1000, 0, 80)).toBeGreaterThan(legFuel('petrol', 1000, 0, 0));
    expect(legFuel('petrol', 1000, 10, 0)).toBeGreaterThan(legFuel('petrol', 1000, 0, 0));
    expect(legFuel('electric', 1000, 0, 0)).toBeLessThan(legFuel('petrol', 1000, 0, 0)); // the battery lasts longer
  });

  it('a job up the hill with cargo costs more than the same job down the hill without', () => {
    const bike = { type: 'petrol', x: 41 * 4, y: 40 * 4 };
    const up = jobFuel(world, bike, { from: { x: 41, y: 45 }, to: { x: 41, y: 100 }, kg: 70 });
    const bikeTop = { type: 'petrol', x: 41 * 4, y: 105 * 4 };
    const down = jobFuel(world, bikeTop, { from: { x: 41, y: 100 }, to: { x: 41, y: 45 }, kg: 0 });
    expect(up).toBeGreaterThan(down * 1.3);
  });

  it('is close to what the bike really uses on the flat', () => {
    const straight = new World({ name: 's', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(600), '#'.repeat(600), '#'.repeat(600)] });
    const b = createBike(straight, 'petrol');
    b.autoShift = true;
    const x0 = b.x;
    for (let t = 0; t < 60; t += 1 / 120) stepBike(b, { throttle: 0.7, brake: 0, steer: 0 }, straight, 1 / 120);
    const used = 1 - b.energy;
    const estimate = legFuel('petrol', b.x - x0, 0, 0);
    expect(estimate).toBeGreaterThan(used * 0.8);
    expect(estimate).toBeLessThan(used * 1.6);
  });
});
