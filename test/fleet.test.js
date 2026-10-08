import { describe, it, expect } from 'vitest';
import { FLEET, LEVELS } from '../src/config.js';
import { fleetRiders, planFleetDay, attachFleet, stepFleet, waitingRider, fleetDayMoney } from '../src/sim/fleet.js';
import { createTraffic } from '../src/sim/traffic.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { startAtLevel } from '../src/sim/levels.js';
import { createWallet } from '../src/sim/economy.js';
import { fleetDayNet } from '../src/sim/balance.js';

const world = new World(buildKigaliMap());
const graph = buildRoadGraph(world.roads);
const shift = LEVELS[5].shift;

describe('hired riders', () => {
  it('hires a rider at level 6 and a second at level 8', () => {
    expect(fleetRiders(startAtLevel(createWallet(), 6))).toEqual([]);
    expect(fleetRiders(startAtLevel(createWallet(), 7))).toEqual([FLEET.names[0]]);
    expect(fleetRiders(startAtLevel(createWallet(), 9))).toEqual(FLEET.names);
  });

  it('plans the same day the same way, with calls and bad days about as often as the config says', () => {
    expect(planFleetDay(FLEET.names, 5, shift)).toEqual(planFleetDay(FLEET.names, 5, shift));
    const days = Array.from({ length: 1500 }, (_, d) => planFleetDay(['A'], d + 1, shift, 11)[0]);
    const calls = days.filter((r) => r.call != null);
    expect(calls.length / days.length).toBeCloseTo(FLEET.helpChance, 1);
    expect(calls.every((r) => r.call >= 11 && r.call <= shift.end - 2)).toBe(true);
    expect(days.filter((r) => r.bad).length / days.length).toBeCloseTo(FLEET.badDayChance, 1);
  });

  it('pays the rent on a good day, and the average day agrees with the balance model', () => {
    const good = fleetDayMoney([{ name: 'A', bad: null, repair: 5000, call: null, help: null }]);
    expect(good.rent - good.costs).toBe(FLEET.rentPerDay - FLEET.costPerDay);
    let sum = 0;
    const n = 4000;
    for (let d = 1; d <= n; d++) {
      const plan = planFleetDay(['A'], d, shift).map((r) => ({ ...r, call: null }));
      const m = fleetDayMoney(plan);
      sum += m.rent - m.costs;
    }
    expect(Math.abs(sum / n - fleetDayNet())).toBeLessThan(250);
  });

  it('a call for help: the rider stops near you; help in time and the rent stays, or lose it', () => {
    for (const helpIt of [true, false]) {
      const traffic = createTraffic(world, graph, mulberry32(4), { car: 4, fleet: 1 });
      const plan = [{ name: 'Jean-Paul', index: 0, bad: null, repair: 0, call: 10, help: null }];
      attachFleet(traffic, plan, mulberry32(1));
      const bike = { x: 30 * 4, y: 96 * 4, speed: 0 };
      const ev = stepFleet(traffic, plan, bike, 10.1, 0.1, mulberry32(2));
      expect(ev[0].type).toBe('call');
      const w = waitingRider(traffic);
      const d = Math.hypot(w.vehicle.x - bike.x, w.vehicle.y - bike.y);
      expect(d).toBeGreaterThan(FLEET.callDistance[0] - 30);
      expect(d).toBeLessThan(FLEET.callDistance[1] + 30);
      if (helpIt) Object.assign(bike, { x: w.vehicle.x + 2, y: w.vehicle.y });
      let last = [];
      for (let t = 0; t < FLEET.helpMinutes * 60 + 5 && !last.length; t += 0.5) last = stepFleet(traffic, plan, bike, 10.2, 0.5, mulberry32(3));
      expect(last[0].type).toBe(helpIt ? 'helped' : 'missed');
      expect(waitingRider(traffic)).toBe(null);
      expect(fleetDayMoney(plan).rent).toBe(helpIt ? FLEET.rentPerDay : 0);
    }
  });
});
