import { describe, it, expect } from 'vitest';
import { trafficHonks } from '../src/sim/honk.js';
import { TRAFFIC } from '../src/config.js';

const H = TRAFFIC.honk;
const step = (traffic, bike, seconds) => {
  const out = [];
  for (let t = 0; t < seconds; t += 0.1) out.push(...trafficHonks(traffic, bike, 0.1, () => 0));
  return out;
};

describe('traffic honks at a bike that blocks the road', () => {
  it('a car that waits behind the bike honks after a few seconds, then again', () => {
    const car = { id: 1, kind: 'car', x: 0, y: 0, heading: 0, speed: 0 };
    const traffic = { vehicles: [car] };
    const bike = { x: 6, y: 0.3, speed: 0 };
    expect(step(traffic, bike, H.afterSeconds - 0.3)).toHaveLength(0);
    expect(step(traffic, bike, 0.6)).toHaveLength(1);
    expect(step(traffic, bike, H.everySeconds[0] + 0.2).length).toBeGreaterThanOrEqual(1);
  });

  it('does not honk when the bike rides on, or stands beside the car, or behind it', () => {
    const car = { id: 1, kind: 'car', x: 0, y: 0, heading: 0, speed: 0 };
    expect(step({ vehicles: [car] }, { x: 6, y: 0, speed: 5 }, 6)).toHaveLength(0);
    expect(step({ vehicles: [car] }, { x: 0, y: 5, speed: 0 }, 6)).toHaveLength(0);
    expect(step({ vehicles: [car] }, { x: -6, y: 0, speed: 0 }, 6)).toHaveLength(0);
  });
});
