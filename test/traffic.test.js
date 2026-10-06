import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph, lanePoint, nearestNode, shortestPath } from '../src/sim/roads.js';
import { createTraffic, stepTraffic, insideVehicle, sendBusToPark } from '../src/sim/traffic.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { TRAFFIC } from '../src/config.js';

const data = buildKigaliMap();
const world = new World(data);
const graph = buildRoadGraph(data.roads);

describe('road graph', () => {
  it('has junction nodes and two way edges', () => {
    expect(graph.nodes.length).toBeGreaterThan(30);
    for (const e of graph.edges) {
      expect(e.reverse).not.toBeNull();
      expect(e.reverse.reverse).toBe(e);
    }
  });

  it('puts every lane point on a road you can ride on', () => {
    for (const e of graph.edges) {
      for (const s of [1, e.length / 2, e.length - 1]) {
        const p = lanePoint(e, s);
        expect(world.isSolidAt(p.x, p.y, false), `edge ${e.id} at ${s}`).toBe(false);
      }
    }
  });

  it('connects the whole network (a path from the bus park to the city)', () => {
    const a = nearestNode(graph, 10 * 4, 21 * 4);
    const b = nearestNode(graph, 85 * 4, 33 * 4);
    const path = shortestPath(graph, a, b);
    expect(path).not.toBeNull();
    expect(path[0].from).toBe(a);
    expect(path[path.length - 1].to).toBe(b);
  });
});

describe('traffic', () => {
  const run = (seconds, obstacles = []) => {
    const t = createTraffic(world, graph, mulberry32(3));
    for (let i = 0; i < seconds * 30; i++) stepTraffic(t, world, obstacles, 1 / 30);
    return t;
  };

  it('spawns the configured number of vehicles', () => {
    const t = createTraffic(world, graph, mulberry32(3));
    const total = Object.values(TRAFFIC.counts).reduce((a, b) => a + b, 0);
    expect(t.vehicles).toHaveLength(total);
  });

  it('keeps vehicles on roads and moving after one minute', () => {
    const t = run(60);
    let moving = 0;
    for (const v of t.vehicles) {
      expect(world.isSolidAt(v.x, v.y, false), `${v.kind} ${v.id}`).toBe(false);
      if (v.speed > 1) moving++;
    }
    expect(moving).toBeGreaterThan(t.vehicles.length * 0.4);
  });

  it('does not lock up: after five minutes almost all vehicles still move', () => {
    const t = run(300);
    const stopped = t.vehicles.filter((v) => v.speed < 0.2 && v.stopTimer <= 0).length;
    expect(stopped).toBeLessThan(t.vehicles.length * 0.2);
  });

  it('a car stops for the bike standing in its lane', () => {
    const t = createTraffic(world, graph, mulberry32(5));
    const car = t.vehicles.find((v) => v.kind === 'car');
    t.vehicles.length = 0;
    t.vehicles.push(car);
    car.speed = 10;
    // Put the bike 12 m ahead of the car in its lane.
    const bike = { x: car.x + Math.cos(car.heading) * 12, y: car.y + Math.sin(car.heading) * 12, length: 2, width: 0.8, speed: 0 };
    for (let i = 0; i < 120; i++) stepTraffic(t, world, [bike], 1 / 30);
    expect(car.speed).toBeLessThan(0.5);
    expect(Math.hypot(car.x - bike.x, car.y - bike.y)).toBeGreaterThan(car.length / 2 + 1);
  });

  it('a truck is much slower uphill', () => {
    // The northern road climbs from the Kinamba valley (x = 64) to Kacyiru hill (x = 76): 19%.
    const t = createTraffic(world, graph, mulberry32(9));
    const truck = t.vehicles.find((v) => v.kind === 'truck');
    const climb = graph.edges.find((e) => e.road.name.startsWith('Northern road') && e.dx > 0 && e.from.x <= 64 * 4 && e.to.x >= 74 * 4);
    t.vehicles.length = 0;
    t.vehicles.push(truck);
    Object.assign(truck, { edge: climb, s: 4 * 4, speed: 0, next: climb.to.out[0], prev: null, route: [] });
    for (let i = 0; i < 300; i++) {
      stepTraffic(t, world, [], 1 / 30);
      if (truck.edge !== climb) break;
    }
    expect(truck.speed * 3.6).toBeLessThan(TRAFFIC.kinds.truck.maxKmh * 0.6);
  });

  it('knows when a point is inside a vehicle', () => {
    const v = { x: 0, y: 0, heading: 0, length: 4, width: 2 };
    expect(insideVehicle(v, 1.9, 0)).toBe(true);
    expect(insideVehicle(v, 0, 1.2)).toBe(false);
  });
});

import { openRoads } from '../src/sim/roads.js';
import { createPeople, busArrivalHails } from '../src/sim/people.js';
describe('Nyabugogo bus park', () => {
  it('a bus sent to the bus park arrives there, and its passengers want motos', () => {
    const w = new World(buildKigaliMap());
    w.setOpenDistricts(['nyabugogo']);
    const g = buildRoadGraph(openRoads(w.roads, w.districts, ['nyabugogo']));
    const stop = w.busStops.find((s) => s.park);
    const sx = (stop.x + 0.5) * 4, sy = (stop.y + 0.5) * 4;
    const parkEdge = g.edges.find((e) => {
      const t = (sx - e.from.x) * e.dx + (sy - e.from.y) * e.dy;
      return t > 0 && t < e.length && Math.abs(-(sx - e.from.x) * e.dy + (sy - e.from.y) * e.dx) < 4;
    });
    expect(parkEdge).toBeTruthy();
    const t = createTraffic(w, g, mulberry32(4), { bus: 1 });
    const bus = t.vehicles[0];
    expect(sendBusToPark(t, bus, parkEdge)).toBe(true);
    let arrived = null;
    for (let i = 0; i < 30 * 240 && !arrived; i++) arrived = stepTraffic(t, w, [], 1 / 30).find((e) => e.type === 'busArrived');
    expect(arrived).toBeTruthy();
    expect(arrived.stop.park).toBe(true);
    const people = createPeople(w, mulberry32(1), { districts: ['nyabugogo'], walkers: 5 });
    const hails = busArrivalHails(people, w, w.places, sx, sy, 3);
    expect(hails).toHaveLength(3);
    for (const h of hails) expect(Math.hypot(h.x - sx, h.y - sy)).toBeLessThan(18);
  });
});
