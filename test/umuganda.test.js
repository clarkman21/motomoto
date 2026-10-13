import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { createTraffic, stepTraffic } from '../src/sim/traffic.js';
import { mulberry32, tripMetres } from '../src/sim/jobs.js';
import { umugandaOffer, onMainRoad, stepPatrols, patrolCount } from '../src/sim/umuganda.js';
import { missionResult } from '../src/sim/missions.js';
import { MISSIONS } from '../src/config.js';

const world = new World(buildKigaliMap());
const U = MISSIONS.umuganda;

describe('the Umuganda run (Alp)', () => {
  it('is a gold mission to a roadside work site, far away, against the clock', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 20; i++) {
      const o = umugandaOffer(world, rng, i, { districts: ['nyabugogo', 'town'] });
      expect(o).not.toBeNull();
      expect(o.mission.kind).toBe('umuganda');
      expect(o.to.name).toMatch(/^Umuganda work site/);
      expect(tripMetres(o.from, o.to)).toBeGreaterThan(200);
      expect(o.mission.limit).toBeGreaterThan(U.extraSeconds);
      if (o.type === 'cargo') expect(o.goods).toBe('tools');
    }
  });

  it('a late run gets no bonus', () => {
    const job = { pay: 1000, mission: { kind: 'umuganda', title: 'UMUGANDA RUN', bonus: 500, limit: 60, timeLeft: -1 } };
    expect(missionResult(job).ok).toBe(false);
    job.mission.timeLeft = 10;
    expect(missionResult(job).bonus).toBe(500);
  });

  it('a patrol that sees you on a main road catches you, unless you get away in time', () => {
    const car = { x: 0, y: 0, heading: 0 };
    const state = { spot: null };
    // In front of the patrol car, on a main road: seen.
    expect(stepPatrols(state, [car], { x: 10, y: 0 }, true, true, 0.1)[0].type).toBe('spotted');
    // Still close after the grace time: caught.
    let ev = [];
    for (let t = 0; t < U.patrolGraceSeconds + 0.5 && !ev.length; t += 0.1) ev = stepPatrols(state, [car], { x: 12, y: 0 }, true, true, 0.1);
    expect(ev[0].type).toBe('caught');
    // Seen again, but this time you ride away: escaped.
    stepPatrols(state, [car], { x: 10, y: 0 }, true, true, 0.1);
    expect(stepPatrols(state, [car], { x: U.patrolEscapeMetres + 5, y: 0 }, true, true, 0.1)[0].type).toBe('escaped');
    // Behind the car, or on a back road, or with no passenger: not seen.
    expect(stepPatrols({ spot: null }, [car], { x: -15, y: 0 }, true, true, 0.1)).toEqual([]);
    expect(stepPatrols({ spot: null }, [car], { x: 10, y: 0 }, true, false, 0.1)).toEqual([]);
    expect(stepPatrols({ spot: null }, [car], { x: 10, y: 0 }, false, true, 0.1)).toEqual([]);
  });

  it('patrol cars keep to the main roads (the murram back roads are safe)', () => {
    const graph = buildRoadGraph(world.roads);
    const traffic = createTraffic(world, graph, mulberry32(3), { police: 6 });
    for (let i = 0; i < 600; i++) {
      stepTraffic(traffic, world, [], 0.1);
      for (const v of traffic.vehicles) expect(v.edge.road?.surface).not.toBe('m');
    }
    expect(patrolCount(['nyabugogo', 'town'])).toBe(2 * U.patrolsPerDistrict);
  });

  it('knows the main roads', () => {
    const tar = [];
    for (let y = 0; y < 128 && tar.length < 3; y++) for (let x = 0; x < 192 && tar.length < 3; x++) if (world.tile(x, y)?.surface === 'tarmac') tar.push([x, y]);
    for (const [x, y] of tar) expect(onMainRoad(world, (x + 0.5) * 4, (y + 0.5) * 4)).toBe(true);
  });
});
