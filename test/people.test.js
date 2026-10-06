import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { createPeople, stepPeople, hailInReach } from '../src/sim/people.js';
import { createJobBoard, acceptHail } from '../src/sim/jobs.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { createTraffic, stepTraffic } from '../src/sim/traffic.js';
import { startRace, chaseHail, stepRivals } from '../src/sim/rivals.js';
import { createBike } from '../src/sim/bike.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { PEOPLE } from '../src/config.js';

const data = buildKigaliMap();
const world = new World(data);
const farBike = { x: 2, y: 2, vx: 0, vy: 0 };

describe('people', () => {
  it('walk for two minutes without walking into buildings or water', () => {
    const people = createPeople(world, mulberry32(4));
    expect(people.walkers).toHaveLength(PEOPLE.walkers);
    const start = people.walkers.map((p) => ({ x: p.x, y: p.y }));
    for (let i = 0; i < 120 * 30; i++) stepPeople(people, world, farBike, world.places, 1 / 30);
    let moved = 0;
    people.walkers.forEach((p, i) => {
      expect(world.isSolidAt(p.x, p.y, false)).toBe(false);
      if (Math.hypot(p.x - start[i].x, p.y - start[i].y) > 5) moved++;
    });
    expect(moved).toBeGreaterThan(PEOPLE.walkers * 0.6);
  });

  it('step aside from a fast bike', () => {
    const people = createPeople(world, mulberry32(4));
    const p = people.walkers[0];
    p.wait = 10; // standing still
    const bike = { x: p.x - 3, y: p.y + 0.3, vx: 8, vy: 0 };
    const y0 = p.y;
    for (let i = 0; i < 15; i++) stepPeople(people, world, bike, world.places, 1 / 30);
    expect(Math.abs(p.y - y0)).toBeGreaterThan(0.3);
  });

  it('customers wave at the roadside, and a stopped bike can take the ride', () => {
    const people = createPeople(world, mulberry32(8));
    for (let i = 0; i < 60 * 30; i++) stepPeople(people, world, farBike, world.places, 1 / 30);
    expect(people.hails.length).toBeGreaterThan(0);
    const h = people.hails[0];
    const tile = world.tileAt(h.x, h.y);
    expect(tile.surface).toBe('pavement');
    const bike = createBike(world);
    bike.x = h.x + 2;
    bike.y = h.y;
    expect(hailInReach(people, bike, 0)).toBe(h);
    expect(hailInReach(people, bike, 10)).toBeNull();
    const board = createJobBoard(world, 1);
    const job = acceptHail(board, h, bike);
    expect(job.stage).toBe('toDropoff');
    expect(job.hail).toBe(true);
    expect(bike.loadType).toBe('passenger');
  });
});

describe('rival riders', () => {
  it('a racing rival drives to the pickup and arrives', () => {
    const graph = buildRoadGraph(data.roads);
    const traffic = createTraffic(world, graph, mulberry32(2));
    const pickup = world.place('townRoundabout');
    const bike = { x: 12 * 4, y: 21 * 4 };
    const rival = startRace(traffic, bike, { ...pickup, jobId: 1 }, () => 0);
    expect(rival).not.toBeNull();
    expect(rival.kind).toBe('moto');
    let arrived = null;
    for (let i = 0; i < 240 * 30 && !arrived; i++) {
      stepTraffic(traffic, world, [], 1 / 30);
      arrived = stepRivals(traffic, 1 / 30).find((e) => e.vehicle === rival) ?? null;
    }
    expect(arrived).not.toBeNull();
    expect(arrived.mission.type).toBe('job');
    expect(rival.loaded).toBe(true);
  });

  it('a rival can go for a street hail', () => {
    const graph = buildRoadGraph(data.roads);
    const traffic = createTraffic(world, graph, mulberry32(2));
    const moto = traffic.vehicles.find((v) => v.kind === 'moto');
    const hail = { id: 99, x: moto.x + 20, y: moto.y };
    expect(chaseHail(traffic, hail, () => 0)).not.toBeNull();
  });
});
