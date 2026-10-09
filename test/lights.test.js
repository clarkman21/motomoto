import { describe, it, expect } from 'vitest';
import { TRAFFIC_LIGHTS as TL } from '../src/config.js';
import { pickLightJunctions, lightState, lightLimit, redLightCheck, attachLights, axisOf } from '../src/sim/lights.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { createTraffic, stepTraffic } from '../src/sim/traffic.js';
import { mulberry32 } from '../src/sim/jobs.js';

const world = new World(buildKigaliMap());
const graph = buildRoadGraph(world.roads);
const lights = pickLightJunctions(world, graph);

describe('traffic lights', () => {
  it('puts lights at big junctions: at most 2 in a district, not too near each other', () => {
    expect(lights.length).toBeGreaterThanOrEqual(6);
    const per = {};
    for (const l of lights) per[l.district] = (per[l.district] ?? 0) + 1;
    expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(TL.perDistrict);
    for (const a of lights) for (const b of lights) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(TL.minSpacingTiles * 4);
  });

  it('never shows green both ways, and each way gets green in a cycle', () => {
    const l = { offset: 0 };
    const seen = { x: new Set(), y: new Set() };
    for (let t = 0; t < 60; t += 0.25) {
      const s = lightState(l, t);
      expect(s.x === 'red' || s.y === 'red').toBe(true);
      seen.x.add(s.x);
      seen.y.add(s.y);
    }
    expect([...seen.x].sort()).toEqual(['amber', 'green', 'red']);
    expect([...seen.y].sort()).toEqual(['amber', 'green', 'red']);
  });

  it('a car stops at the stop line on red, and goes on green', () => {
    const red = { offset: TL.greenSeconds + TL.amberSeconds + TL.allRedSeconds + 1 }; // y is green, x is red
    const edge = { dx: 1, dy: 0 };
    expect(lightLimit(red, 0, edge, 30, 10, 6)).toBeCloseTo((30 - TL.stopMetres) * 1.2);
    expect(lightLimit(red, 0, edge, TL.stopMetres, 0, 6)).toBe(0);
    expect(lightLimit(red, 0, { dx: 0, dy: 1 }, 30, 10, 6)).toBe(Infinity); // green for y
    expect(lightLimit(red, 0, edge, TL.stopMetres - 2, 10, 6)).toBe(Infinity); // already over the line
  });

  it('cars queue at a red light in the game traffic', () => {
    attachLights(graph, lights);
    const traffic = createTraffic(world, graph, mulberry32(9), { car: 120 });
    let waited = 0;
    for (let i = 0; i < 300 && !waited; i++) {
      stepTraffic(traffic, world, [], 1 / 10);
      waited += traffic.vehicles.filter((v) => v.why === 'light').length;
    }
    expect(waited).toBeGreaterThan(0);
    attachLights(graph, []);
  }, 20000);

  it('the bike through a red light is seen once as it goes into the junction box', () => {
    const l = { x: 100, y: 100, offset: 0 }; // x green at t = 0, so y is red
    const bike = { x: 100, y: 100 - TL.boxMetres + 0.2, vx: 0, vy: 8 };
    expect(redLightCheck(l, 0, bike, false)).toEqual({ inside: true, red: true });
    expect(redLightCheck(l, 0, bike, true).red).toBe(false);
    expect(redLightCheck(l, 0, { ...bike, vx: 8, vy: 0 }, false).red).toBe(false); // along x: green
    expect(axisOf(0.2, -3)).toBe('y');
  });
});
