import { describe, it, expect } from 'vitest';
import { MODES, CROSSINGS as CR } from '../src/config.js';
import { crossingPaths, stepCrossers } from '../src/sim/crossers.js';
import { createPeople, stepPeople } from '../src/sim/people.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';

const world = new World(buildKigaliMap());
const paths = crossingPaths(world);
const mode = (id) => ({ id, ...MODES[id] });

describe('people on the zebra crossings', () => {
  it('finds the crossings of the map, with a kerb at each end', () => {
    expect(paths.length).toBeGreaterThan(30);
    for (const p of paths) {
      const len = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y);
      expect(len).toBeGreaterThan(8); // a road 2 tiles wide, plus a step onto each kerb
      expect(p.a.x === p.b.x || p.a.y === p.b.y).toBe(true); // straight across the road
    }
  });

  it('people cross near you, more often in hard mode, and walk to the far kerb', () => {
    const path = paths[0];
    const bike = { x: path.cx + 30, y: path.cy, vx: 0, vy: 0 };
    const count = (m) => {
      const people = createPeople(world, mulberry32(5), { walkers: 0 });
      const state = { timers: new Map(), seen: new Set() };
      let made = 0;
      for (let t = 0; t < 25; t += 0.5) {
        const before = people.walkers.filter((p) => p.crosser).length;
        stepCrossers(state, people, [path], { bike, movers: [], mode: mode(m) }, 0.5);
        made += Math.max(0, people.walkers.filter((p) => p.crosser).length - before);
        stepPeople(people, world, bike, world.places, 0.5);
      }
      return made;
    };
    expect(count('hard')).toBeGreaterThan(count('easy'));
    expect(count('medium')).toBeGreaterThan(0);
  });

  it('people wait for a gap in the traffic (medium); ride through fast: an event', () => {
    const path = paths[0];
    const people = createPeople(world, mulberry32(7), { walkers: 0 });
    const state = { timers: new Map([[path.id, 0]]), seen: new Set() };
    const car = { x: path.cx + 5, y: path.cy, speed: 10 };
    stepCrossers(state, people, [path], { bike: { x: path.cx + 40, y: path.cy, vx: 0, vy: 0 }, movers: [car], mode: { ...mode('medium'), crossStepOut: 0 } }, 0.1);
    expect(people.walkers.length).toBe(0); // a car comes: nobody steps out
    state.timers.set(path.id, 0);
    stepCrossers(state, people, [path], { bike: { x: path.cx + 40, y: path.cy, vx: 0, vy: 0 }, movers: [], mode: mode('medium') }, 0.1);
    const p = people.walkers[0];
    expect(p.crosser).toBe(true);
    const fast = { x: p.x + 1, y: p.y, vx: 8, vy: 0 };
    const ev = stepCrossers(state, people, [], { bike: fast, movers: [], mode: mode('medium') }, 0.1);
    expect(ev.map((e) => e.type)).toEqual(['ranCrossing']);
    expect(stepCrossers(state, people, [], { bike: fast, movers: [], mode: mode('medium') }, 0.1)).toEqual([]); // once
    expect(CR.fine).toBeGreaterThan(0);
  });
});
