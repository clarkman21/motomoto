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
  it('has junction nodes and two way edges (the roundabouts are one way)', () => {
    expect(graph.nodes.length).toBeGreaterThan(30);
    for (const e of graph.edges) {
      if (e.road.ring) {
        expect(e.reverse).toBeNull();
        continue;
      }
      expect(e.reverse).not.toBeNull();
      expect(e.reverse.reverse).toBe(e);
    }
  });

  it('has 3 round roundabouts, driven anticlockwise on the screen (right hand traffic)', () => {
    const rings = data.roads.filter((r) => r.ring);
    expect(rings.map((r) => r.name).sort()).toEqual(['KCC roundabout', 'MTN roundabout', 'Town roundabout']);
    for (const R of rings) {
      const edges = graph.edges.filter((e) => e.road === R);
      expect(edges).toHaveLength(16);
      for (const e of edges) {
        // Anticlockwise seen from above with y down: the cross product of (from − centre) and the direction is < 0.
        const rx = e.from.x - R.cx * 4, ry = e.from.y - R.cy * 4;
        expect(rx * e.dy - ry * e.dx).toBeLessThan(0);
      }
      // Four roads meet each ring: each meeting point has a way onto the ring and a way off it.
      const meet = graph.nodes.filter((n) => n.out.some((e) => e.road === R) && n.out.some((e) => !e.road.ring));
      expect(meet.length).toBe(4);
    }
  });

  it('a route across a roundabout goes round it, the right way', () => {
    const R = data.roads.find((r) => r.name === 'Town roundabout');
    const T = 4;
    const north = nearestNode(graph, R.cx * T, (R.cy - 9) * T), west = nearestNode(graph, (R.cx - 9) * T, R.cy * T);
    const path = shortestPath(graph, north, west);
    expect(path).not.toBeNull();
    const onRing = path.filter((e) => e.road === R);
    expect(onRing.length).toBeGreaterThan(0);
    // From the north to the west, anticlockwise is the short way (a quarter of the ring).
    expect(onRing.length).toBe(4);
  });

  it('puts the ring on tarmac with a grass island', () => {
    const R = data.roads.find((r) => r.name === 'KCC roundabout');
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      expect(world.tileAt((R.cx + R.r * Math.cos(a)) * 4, (R.cy + R.r * Math.sin(a)) * 4).surface).toBe('tarmac');
    }
    expect(world.tileAt(R.cx * 4 + 2, R.cy * 4 + 2).surface).toBe('grass');
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

  it('a car gives way to the traffic on a roundabout, then goes round it', () => {
    const R = data.roads.find((r) => r.name === 'KCC roundabout');
    const t = createTraffic(world, graph, mulberry32(5));
    const [a, b] = t.vehicles.filter((v) => v.kind === 'car');
    t.vehicles.length = 0;
    t.vehicles.push(a, b);
    // The meeting point at the north of the ring, the road that comes in from the north, and the ring edges.
    const north = graph.nodes.find((n) => Math.abs(n.x - R.cx * 4) < 0.1 && Math.abs(n.y - (R.cy - R.r) * 4) < 0.1);
    const inEdge = graph.edges.find((e) => e.to === north && !e.road.ring);
    const ringOut = north.out.find((e) => e.road === R);
    const ringIn = graph.edges.find((e) => e.road === R && e.to === north);
    const before = graph.edges.find((e) => e.road === R && e.to === ringIn.from);
    Object.assign(a, { edge: inEdge, prev: null, next: ringOut, s: inEdge.length - 8, speed: 6, route: [] });
    Object.assign(b, { edge: before, prev: null, next: ringIn, s: 2, speed: 6, route: [] });
    let waited = false;
    for (let i = 0; i < 30 * 8; i++) {
      stepTraffic(t, world, [], 1 / 30);
      if (a.why === 'giveWay') waited = true;
    }
    expect(waited).toBe(true);
    expect(a.edge.road === R || a.prev?.road === R).toBe(true); // a got onto the ring in the end
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

describe('cyclists', () => {
  it('ride slowly at the road edge, and a car can pass them', () => {
    const t = createTraffic(world, graph, mulberry32(5), { cyclist: 1, car: 1 });
    const [bikeV, car] = t.vehicles;
    const edge = graph.edges.find((e) => e.length > 120);
    Object.assign(bikeV, { edge, s: 40, speed: 4, next: edge.to.out[0], prev: null, route: [] });
    Object.assign(car, { edge, s: 20, speed: 10, next: edge.to.out[0], prev: null, route: [] });
    for (let i = 0; i < 30 * 6; i++) stepTraffic(t, world, [], 1 / 30);
    expect(bikeV.speed * 3.6).toBeLessThanOrEqual(TRAFFIC.kinds.cyclist.maxKmh * 1.2);
    expect(car.edge !== edge || car.s > bikeV.s).toBe(true); // the car went past
  });
});

import { HAZARDS } from '../src/config.js';
describe('traffic and road hazards', () => {
  it('a car slows down for a speed bump, as the bike must, and bounces over it', () => {
    // Speed bumps on the northern road in Nyabugogo (x = 26 and 34, rows 20 and 21).
    const t = createTraffic(world, graph, mulberry32(3), { car: 1 });
    const car = t.vehicles[0];
    const edge = graph.edges.find((e) => e.road.name.startsWith('Northern road') && e.dx > 0 && e.from.x <= 20 * 4 && e.to.x >= 30 * 4);
    Object.assign(car, { edge, s: 20 * 4 - edge.from.x, speed: 14, next: edge.to.out[0], prev: null, route: [], maxSpeed: 14 });
    let minNearBump = Infinity, bounced = false;
    for (let i = 0; i < 30 * 8; i++) {
      stepTraffic(t, world, [], 1 / 30);
      if (Math.abs(car.x / 4 - 26.5) < 1) minNearBump = Math.min(minNearBump, car.speed);
      if (car.bump > 0) bounced = true;
    }
    expect(minNearBump * 3.6).toBeLessThan(HAZARDS.speedBump.safeSpeedKmh);
    expect(bounced).toBe(true);
  });
});
