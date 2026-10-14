import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { createTraffic, stepTraffic, addVehicle } from '../src/sim/traffic.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { TRAFFIC } from '../src/config.js';

// Vehicles must not drive through each other (Alp, 14 October 2026), and a few real crashes happen near you.

const data = buildKigaliMap();
const world = new World(data);
const graph = buildRoadGraph(data.roads);
const saved = { ...TRAFFIC.crash };
afterEach(() => Object.assign(TRAFFIC.crash, saved));

// The distance between the centre lines of two vehicles (each a segment along its heading).
function centreGap(a, b) {
  const seg = (v) => { const h = (v.length - v.width) / 2, c = Math.cos(v.heading), s = Math.sin(v.heading); return [v.x - c * h, v.y - s * h, v.x + c * h, v.y + s * h]; };
  const d = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  };
  const A = seg(a), B = seg(b);
  return Math.min(d(A[0], A[1], ...B), d(A[2], A[3], ...B), d(B[0], B[1], ...A), d(B[2], B[3], ...A));
}

/** A crossroads without lights: two roads in, each with a straight way on. */
function crossroads() {
  for (const n of graph.nodes) {
    if (n.out.length !== 4 || n.light || n.out.some((e) => e.road?.ring || !e.reverse)) continue;
    const ins = n.out.map((e) => e.reverse).filter((e) => e.length > 30);
    for (const a of ins) for (const b of ins) {
      if (Math.abs(a.dx * b.dx + a.dy * b.dy) > 0.1) continue; // perpendicular
      const on = (e) => n.out.find((o) => o.dx * e.dx + o.dy * e.dy > 0.95);
      if (on(a) && on(b)) return { a, b, aOn: on(a), bOn: on(b) };
    }
  }
  return null;
}

describe('traffic collisions', () => {
  it('a car does not drive through a slow truck that crosses in front of it', () => {
    const x = crossroads();
    expect(x).not.toBeNull();
    const t = createTraffic(world, graph, mulberry32(1), {});
    // The tipper crawls over the crossroads; its junction claim ends long before it is across.
    const truck = addVehicle(t, 'tipper', x.a, x.a.length - 7, [x.aOn]);
    const car = addVehicle(t, 'car', x.b, x.b.length - 40, [x.bOn]);
    t.vehicles.push(truck, car);
    truck.maxSpeed = 1.2;
    car.speed = 9;
    let closest = Infinity;
    for (let i = 0; i < 40 * 30; i++) {
      stepTraffic(t, world, [], 1 / 30);
      closest = Math.min(closest, centreGap(truck, car));
    }
    expect(closest).toBeGreaterThan((truck.width + car.width) / 2 * 0.8);
    // Both went on through the crossroads.
    expect(truck.edge).not.toBe(x.a);
    expect(car.edge).not.toBe(x.b);
  });

  it('no crash happens without a focus (the bike), and none far from it', () => {
    TRAFFIC.crash.chance = 1;
    TRAFFIC.crash.everySeconds = 0;
    const t = createTraffic(world, graph, mulberry32(2), { car: 120, bus: 20, truck: 20, taxi: 40 });
    let n = 0;
    for (let i = 0; i < 30 * 30; i++) n += stepTraffic(t, world, [], 1 / 30).filter((e) => e.type === 'vehicleCrash').length;
    expect(n).toBe(0);
    t.focus = { x: -5000, y: -5000 };
    for (let i = 0; i < 30 * 30; i++) n += stepTraffic(t, world, [], 1 / 30).filter((e) => e.type === 'vehicleCrash').length;
    expect(n).toBe(0);
  });

  it('a crash near the focus stops both vehicles; they drive on later', () => {
    TRAFFIC.crash.chance = 1;
    TRAFFIC.crash.nearMetres = 1e6;
    const t = createTraffic(world, graph, mulberry32(2), { car: 120, bus: 20, truck: 20, taxi: 40 });
    t.focus = { x: 0, y: 0 };
    let crash = null;
    for (let i = 0; i < 120 * 30 && !crash; i++) crash = stepTraffic(t, world, [], 1 / 30).find((e) => e.type === 'vehicleCrash');
    expect(crash).toBeTruthy();
    const { a, b } = crash;
    expect(a.crashed).toBeGreaterThan(0);
    expect(b.crashed).toBeGreaterThan(0);
    // Only one crash in everySeconds.
    let more = 0;
    for (let i = 0; i < (TRAFFIC.crash.seconds - 2) * 30; i++) {
      more += stepTraffic(t, world, [], 1 / 30).filter((e) => e.type === 'vehicleCrash').length;
      expect(a.speed).toBe(0);
      expect(b.speed).toBe(0);
    }
    expect(more).toBe(0);
    for (let i = 0; i < 20 * 30; i++) stepTraffic(t, world, [], 1 / 30);
    expect(a.crashed).toBeLessThanOrEqual(0);
    expect(a.crashTilt).toBe(0);
  });

  it('a car behind a crash waits a moment, then drives round it and back into its lane', () => {
    const e = graph.edges.find((g) => g.length > 80 && !g.road?.ring && g.road?.surface !== 'm');
    const t = createTraffic(world, graph, mulberry32(4), {});
    const wreck = addVehicle(t, 'car', e, 40, []);
    const car = addVehicle(t, 'car', e, 15, []);
    t.vehicles.push(wreck, car);
    wreck.crashed = 60;
    car.speed = 8;
    let waited = 0, maxSwerve = 0;
    for (let i = 0; i < 25 * 30; i++) {
      stepTraffic(t, world, [], 1 / 30);
      if (car.edge === e && car.speed < 0.5) waited += 1 / 30;
      maxSwerve = Math.max(maxSwerve, car.swerve ?? 0);
      if (car.edge === e) expect(centreGap(car, wreck)).toBeGreaterThan(0.3);
    }
    expect(waited).toBeGreaterThan(TRAFFIC.crash.swerveAfterSeconds * 0.8);
    expect(maxSwerve).toBeGreaterThan(1.5);
    expect(car.edge !== e || car.s > 45).toBe(true);
    expect(car.passing).toBeFalsy();
  });
});
