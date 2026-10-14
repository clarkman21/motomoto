import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph, openRoads } from '../src/sim/roads.js';
import { mulberry32 } from '../src/sim/jobs.js';
import {
  oneWayRoads, noMotoRoads, onRoad, oneWayDir, pruneOneWay, strictOneWays, streetRule, pickSpeedChecks, speedChecks,
  overloaded, maybeHeavy, stepBladder, drinkToBladder, bladderPower,
} from '../src/sim/hardrules.js';
import { HARD_RULES as H, WORLD, MODES } from '../src/config.js';

const world = new World(buildKigaliMap());
const T = WORLD.tileMetres;
const districtAt = (x, y) => world.districtAt(Math.floor(x / T), Math.floor(y / T));
const ALL = ['nyabugogo', 'town', 'kacyiru', 'kimihurura', 'kicukiro', 'nyarutarama'];

describe('hard mode challenges', () => {
  it('the fines and the bathroom need are only on hard mode', () => {
    expect(MODES.hard.fines && MODES.hard.bladder).toBe(true);
    for (const m of ['easy', 'medium']) expect(!!MODES[m].bladder || !!MODES[m].fines).toBe(false);
  });

  it('finds the one-way and no-moto roads on the map; no job place is on a no-moto road', () => {
    const ones = oneWayRoads(world.roads);
    expect(ones.length).toBeGreaterThanOrEqual(2);
    const nos = noMotoRoads(world.roads);
    expect(nos.length).toBeGreaterThanOrEqual(1);
    for (const p of world.places) for (const r of nos) expect(onRoad(r, Math.floor(p.x), Math.floor(p.y))).toBe(false);
  });

  it('traffic keeps to the one-way streets, and every node still has a way out (also in a level graph of copied roads)', () => {
    const graph = buildRoadGraph(openRoads(world.roads, world.districts, ALL));
    const ones = oneWayRoads(world.roads);
    const removed = pruneOneWay(graph, ones);
    expect(removed).toBeGreaterThan(0);
    for (const n of graph.nodes) expect(n.out.length).toBeGreaterThan(0);
    // With no dead ends, every one-way part can be strict (before, a dead-end part kept its way back).
    const strict = strictOneWays(graph, ones);
    expect(strict.length).toBeGreaterThanOrEqual(2);
    expect(strict.length).toBeLessThanOrEqual(ones.length); // no dead ends now, so all the one-way parts can be strict
    for (const o of strict) {
      const d = oneWayDir(o);
      const along = graph.edges.filter((e) => e.road.name === o.road.name && onRoad(o.road, Math.floor((e.from.x + e.to.x) / 2 / T), Math.floor((e.from.y + e.to.y) / 2 / T)));
      expect(along.length).toBeGreaterThanOrEqual(1);
      const wrong = along.filter((e) => e.dx * d.x + e.dy * d.y < -0.5);
      for (const e of wrong) expect(e.from.out.length === 1 && e.length <= 2 * T).toBe(true); // only a short stub at a dead end
    }
  });

  it('the wrong way on a one-way street and a no-moto street break a rule; the right way does not', () => {
    const ones = oneWayRoads(world.roads), nos = noMotoRoads(world.roads);
    const o = ones[0], d = oneWayDir(o), r = o.road;
    const x = (r.y !== undefined ? (r.x0 + r.x1) / 2 : r.x + 0.5) * T, y = (r.y !== undefined ? r.y + 0.5 : (r.y0 + r.y1) / 2) * T;
    expect(streetRule(ones, nos, { x, y, vx: d.x * 8, vy: d.y * 8 })).toBe(null);
    expect(streetRule(ones, nos, { x, y, vx: -d.x * 8, vy: -d.y * 8 })).toBe('oneWay');
    const n = nos[0];
    const nx = (n.y !== undefined ? (n.x0 + n.x1) / 2 : n.x + 0.5) * T, ny = (n.y !== undefined ? n.y + 0.5 : (n.y0 + n.y1) / 2) * T;
    expect(streetRule(ones, nos, { x: nx, y: ny, vx: 5, vy: 0 })).toBe('noMoto');
  });

  it('speed checks: none before their level; the same each day; one reading each time you pass', () => {
    const graph = buildRoadGraph(world.roads);
    expect(pickSpeedChecks(graph, districtAt, ALL, 1, H.speedChecks.fromLevel - 1)).toEqual([]);
    const checks = pickSpeedChecks(graph, districtAt, ALL, 4, 6);
    expect(checks.length).toBe(H.speedChecks.perDay);
    expect(checks).toEqual(pickSpeedChecks(graph, districtAt, ALL, 4, 6));
    const c = checks[0], state = new Map();
    const at = { x: c.x + 5, y: c.y };
    const first = speedChecks(state, checks, at, 70, 40);
    expect(first.length).toBe(1);
    expect(first[0].fine).toBeGreaterThan(0);
    expect(speedChecks(state, checks, at, 70, 40)).toEqual([]); // still inside: no second reading
    speedChecks(state, checks, { x: c.x + 200, y: c.y + 200 }, 0, 40);
    expect(speedChecks(state, checks, at, 30, 40)[0].fine).toBe(0); // under the limit: no fine
  });

  it('overloading: only heavy cargo is too heavy; heavy offers pay more', () => {
    expect(overloaded({ type: 'cargo', kg: H.overload.limitKg + 5 })).toBe(true);
    expect(overloaded({ type: 'cargo', kg: 30 })).toBe(false);
    expect(overloaded({ type: 'passenger', kg: 200 })).toBe(false);
    const rng = mulberry32(5);
    let heavy = 0;
    for (let i = 0; i < 400; i++) {
      const o = maybeHeavy({ type: 'cargo', kg: 30, pay: 2000 }, rng);
      if (o.heavy) {
        heavy++;
        expect(overloaded(o)).toBe(true);
        expect(o.pay).toBeGreaterThan(2000);
      }
    }
    expect(heavy / 400).toBeGreaterThan(H.overload.heavyShare * 0.6);
    expect(heavy / 400).toBeLessThan(H.overload.heavyShare * 1.4);
    expect(maybeHeavy({ type: 'passenger', pay: 1000 }, rng).heavy).toBeUndefined();
  });

  it('the bathroom need: fills with time and drinks, says urgent once, and full means less power', () => {
    const rider = { bladder: 0 };
    expect(bladderPower(rider)).toBe(1);
    drinkToBladder(rider, 'drink');
    expect(rider.bladder).toBeCloseTo(H.bladder.drink);
    let urgent = 0;
    for (let h = 0; h < 20; h++) if (stepBladder(rider, 0.5)) urgent++;
    expect(urgent).toBe(1);
    expect(rider.bladder).toBe(1);
    expect(bladderPower(rider)).toBe(H.bladder.fullPower);
  });
});
