import { describe, it, expect } from 'vitest';
import { MODES } from '../src/config.js';
import { isRushHour, rushCounts, markRush, stepRush } from '../src/sim/rush.js';
import { wakeTraffic } from '../src/sim/events.js';

const car = (id, x) => ({ id, kind: 'car', x, y: 0 });

describe('rush hours', () => {
  it('in the morning and the evening, not at noon', () => {
    expect(isRushHour(8)).toBe(true);
    expect(isRushHour(18)).toBe(true);
    expect(isRushHour(12)).toBe(false);
    expect(rushCounts({ car: 10, bus: 4 }, MODES.hard.rushExtra).car).toBeGreaterThan(rushCounts({ car: 10, bus: 4 }, MODES.medium.rushExtra).car);
    expect(rushCounts({ car: 10, bus: 4 }, MODES.easy.rushExtra)).toEqual({ car: 0, bus: 0 });
  });

  it('extra cars wait off the road, come in a rush hour far from you, and go after it', () => {
    const traffic = { vehicles: Array.from({ length: 10 }, (_, i) => car(i, i * 30)) };
    markRush(traffic, { car: 4, bus: 0 });
    expect(traffic.vehicles).toHaveLength(6);
    expect(traffic.dormant).toHaveLength(4);
    const bike = { x: 0, y: 0 };
    stepRush(traffic, 8, bike);
    expect(traffic.vehicles.filter((v) => v.rush).length).toBe(4); // all far from x = 0
    stepRush(traffic, 12, { x: 270, y: 0 }); // after the rush; the bike is near the last car
    expect(traffic.vehicles.filter((v) => v.rush).length).toBe(3); // the 3 within 80 m stay (you could see them)
    // The Umuganda wake leaves the rush cars off the road.
    const t2 = { vehicles: [], dormant: [{ ...car(1, 500), rush: true }, car(2, 500)] };
    wakeTraffic(t2, 0, 0, 70);
    expect(t2.vehicles.map((v) => v.id)).toEqual([2]);
  });
});
