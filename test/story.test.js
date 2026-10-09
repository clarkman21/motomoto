import { describe, it, expect } from 'vitest';
import { smogAt } from '../src/sim/story.js';
import { endingStory } from '../src/sim/family.js';
import { drawEndingPicture } from '../src/world/story-sprites.js';
import { COLOURS, SMOG } from '../src/config.js';

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

describe('the ending', () => {
  const stats = { days: 64, totalIncome: 2345670, milestones: 10, network: 7, secrets: 4, secretsTotal: 6, modeName: 'Kigali 2015' };

  it('tells the story and shows the career numbers and the credits', () => {
    const e = endingStory(stats);
    expect(e.title).toBe('THE END');
    expect(e.lines.join(' ')).toMatch(/Nyabugogo/);
    expect(e.lines.join(' ')).toMatch(/clear/);
    expect(e.stats.join(' ')).toMatch(/2,345,670 RWF/);
    expect(e.stats.join(' ')).toMatch(/4 of 6/);
    expect(e.short).toMatch(/64 days/);
    expect(e.credits.join(' ')).toMatch(/Alp/);
  });

  it('the picture has a clear blue sky (no smog colour) and yellow electric motos', () => {
    const c = drawEndingPicture(240, 64);
    const colours = new Set();
    for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3]) colours.add((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]);
    expect(colours.has(COLOURS.ampersandYellow)).toBe(true);
    expect(colours.has(SMOG.colour)).toBe(false);
    // The top row is sky blue.
    expect(c.data[2]).toBeGreaterThan(c.data[0]);
  });

  it('the picture fits a small screen', () => {
    expect(() => drawEndingPicture(150, 44)).not.toThrow();
  });
});
