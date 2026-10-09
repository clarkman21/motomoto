import { describe, it, expect } from 'vitest';
import { smogAt } from '../src/sim/story.js';

describe('the story arc: petrol to electric', () => {
  it('the smog is thick at level 1, thinner at each level, and gone at the end', () => {
    for (let l = 1; l < 11; l++) expect(smogAt(l + 1)).toBeLessThan(smogAt(l));
    expect(smogAt(1)).toBeGreaterThan(0.25);
    expect(smogAt(11)).toBe(0);
    expect(smogAt(12)).toBe(0);
  });
});

import { STORY } from '../src/config.js';
import { batterySpots, takeBattery } from '../src/sim/story.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { createBike, stepBike } from '../src/sim/bike.js';

describe('the yellow battery (levels 3 and 4)', () => {
  const world = new World(buildKigaliMap());
  it('puts batteries on tarmac in the open districts, the same each time for a day', () => {
    const a = batterySpots(world, ['nyabugogo', 'town'], 4);
    expect(a).toHaveLength(STORY.batteriesPerDay);
    expect(a).toEqual(batterySpots(world, ['nyabugogo', 'town'], 4));
    for (const s of a) expect(world.tileAt(s.x, s.y).surface).toBe('tarmac');
  });

  it('ride over one: it is taken once', () => {
    const spots = [{ id: 0, x: 10, y: 10, taken: false }];
    expect(takeBattery(spots, { x: 11, y: 10 })).toBe(spots[0]);
    expect(takeBattery(spots, { x: 11, y: 10 })).toBe(null);
  });

  it('a boost: no fuel use while it lasts', () => {
    const road = new World({ name: 'r', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(80), '#'.repeat(80), '#'.repeat(80)], hills: [] });
    const run = (boost) => {
      const bike = createBike(road);
      bike.autoShift = true;
      bike.boost = boost;
      const e0 = bike.energy;
      for (let t = 0; t < 3; t += 1 / 60) stepBike(bike, { steer: 0, throttle: 1, brake: 0 }, road, 1 / 60);
      return e0 - bike.energy;
    };
    expect(run(10)).toBe(0);
    expect(run(0)).toBeGreaterThan(0);
  });
});
