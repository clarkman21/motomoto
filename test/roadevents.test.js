import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { createTraffic, stepTraffic } from '../src/sim/traffic.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { pickRoadWorks, planConvoy, convoyVehicles, convoyCheck, isCarFreeDay, carFreeNow, carFreeRoads, slowZoneLimit } from '../src/sim/roadevents.js';
import { addVehicle } from '../src/sim/traffic.js';
import { ROAD_EVENTS, WORLD } from '../src/config.js';

const world = new World(buildKigaliMap());
const graph = buildRoadGraph(world.roads);
const T = WORLD.tileMetres;
const districtAt = (x, y) => world.districtAt(Math.floor(x / T), Math.floor(y / T));
const ALL = ['nyabugogo', 'town', 'kacyiru', 'kimihurura', 'kicukiro', 'nyarutarama'];

describe('street events', () => {
  it('road works: cones at the road edge, workers, a sign, and a slow zone; none before level 3', () => {
    expect(pickRoadWorks(graph, districtAt, ALL, 1, 2)).toEqual([]);
    let total = 0;
    for (let day = 1; day <= 10; day++) {
      const works = pickRoadWorks(graph, districtAt, ALL, day, 6);
      expect(works).toEqual(pickRoadWorks(graph, districtAt, ALL, day, 6)); // the same day, the same works
      for (const w of works) {
        expect(w.cones.length).toBeGreaterThan(5);
        expect(w.workers.length).toBe(2);
        expect(w.zone.kmh).toBe(ROAD_EVENTS.works.kmh);
      }
      total += works.length;
    }
    expect(total).toBeGreaterThan(10);
  });

  it('traffic slows down in a road works zone', () => {
    const zones = [{ x: 0, y: 0, r: 10, kmh: 18 }];
    expect(slowZoneLimit(zones, 3, 0)).toBeCloseTo(5);
    expect(slowZoneLimit(zones, 30, 0)).toBe(Infinity);
  });

  it('a VIP convoy: a police car first, black cars behind, on the main roads, at an hour in the shift', () => {
    let plan = null;
    for (let day = 1; day < 40 && !plan; day++) plan = planConvoy(graph, districtAt, ALL, day, 8, { start: 6, end: 22 });
    expect(plan).not.toBeNull();
    expect(plan.hour).toBeGreaterThanOrEqual(7);
    expect(plan.route.every((e) => e.road.surface !== 'm')).toBe(true);
    expect(planConvoy(graph, districtAt, ALL, 3, 2, { start: 6, end: 22 })).toBeNull(); // too early in the game
    const traffic = createTraffic(world, graph, mulberry32(1), {});
    const cars = convoyVehicles(plan, (kind, edge, s, route) => addVehicle(traffic, kind, edge, s, route));
    expect(cars.map((v) => v.kind)).toEqual(['police', ...Array(ROAD_EVENTS.vip.cars).fill('vip')]);
    traffic.vehicles.push(...cars);
    for (let i = 0; i < 300; i++) stepTraffic(traffic, world, [], 0.1);
    // They keep together on the same route.
    const lead = cars[0];
    for (const v of cars.slice(1)) expect(Math.hypot(v.x - lead.x, v.y - lead.y)).toBeLessThan(80);
    // Ride on near the convoy: a violation; stand still: none.
    expect(convoyCheck(cars, { x: lead.x + 5, y: lead.y }, 30).violation).toBe(true);
    expect(convoyCheck(cars, { x: lead.x + 5, y: lead.y }, 0).violation).toBe(false);
  });

  it('a car free morning closes the boulevard to traffic from 7:00 to 10:00', () => {
    const roads = carFreeRoads(world.roads);
    expect(roads.map((r) => r.name)).toEqual(['Kacyiru boulevard']);
    expect(carFreeNow(8)).toBe(true);
    expect(carFreeNow(10.5)).toBe(false);
    let days = 0;
    for (let d = 1; d <= 100; d++) if (isCarFreeDay(d, 6, null)) days++;
    expect(days).toBeGreaterThan(5);
    expect(days).toBeLessThan(40);
    expect(isCarFreeDay(5, 6, 'umuganda')).toBe(false);
    const traffic = createTraffic(world, graph, mulberry32(2), { car: 60 });
    traffic.closed = new Set(roads);
    traffic.vehicles = traffic.vehicles.filter((v) => !traffic.closed.has(v.edge.road));
    let onClosed = 0;
    for (let i = 0; i < 400; i++) {
      stepTraffic(traffic, world, [], 0.1);
      onClosed += traffic.vehicles.filter((v) => traffic.closed.has(v.edge.road)).length;
    }
    expect(onClosed).toBeLessThan(400 * 60 * 0.01); // under 1%: only where there is no other way
  });
});
