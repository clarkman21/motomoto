import { describe, it, expect } from 'vitest';
import { createTilt, tiltBlocked, startTilt, stepTilt, tiltAngle } from '../src/sim/fuel-tilt.js';
import { createBike, stepBike, sputters } from '../src/sim/bike.js';
import { World } from '../src/world/world.js';
import { TEST_MAP } from '../src/world/map-data.js';
import { BIKES, FUEL } from '../src/config.js';

// Low fuel (Alp, 15 October 2026): the engine sputters, and when the tank is empty you can do the fuel
// tilt one time to get a little more riding.

const world = new World(TEST_MAP);
const empty = () => ({ type: 'petrol', energy: 0, brokenDown: false, crashed: 0 });
const run = (tilt, bike, seconds) => {
  const out = [];
  for (let t = 0; t < seconds; t += 0.1) out.push(stepTilt(tilt, bike, 0.1));
  return out.filter(Boolean);
};

describe('the fuel tilt', () => {
  it('needs an empty petrol tank, a stopped moto, and no tilt since the last fuel', () => {
    const tilt = createTilt();
    expect(tiltBlocked(tilt, { ...empty(), energy: 0.3 }, 0)).toBe('fuel');
    expect(tiltBlocked(tilt, { ...empty(), type: 'electric' }, 0)).toBe('electric');
    expect(tiltBlocked(tilt, { ...empty(), brokenDown: true }, 0)).toBe('broken');
    expect(tiltBlocked(tilt, empty(), 10)).toBe('moving');
    expect(tiltBlocked(tilt, empty(), 0)).toBeNull();
  });

  it('takes a few seconds, rocks the moto on its side, then gives about 30 s of fuel', () => {
    const tilt = createTilt(), bike = empty();
    expect(startTilt(tilt, bike, 0)).toBe(true);
    expect(startTilt(tilt, bike, 0)).toBe(false); // busy
    run(tilt, bike, 1);
    expect(tiltAngle(tilt)).toBeGreaterThan(30);
    expect(bike.energy).toBe(0);
    expect(run(tilt, bike, FUEL.tilt.seconds)).toEqual(['done']);
    expect(tiltAngle(tilt)).toBe(0);
    expect(bike.energy).toBeCloseTo(FUEL.tilt.fuel);
    // About 30 s at full throttle on the flat.
    const seconds = FUEL.tilt.fuel * BIKES.petrol.energySeconds;
    expect(seconds).toBeGreaterThan(20);
    expect(seconds).toBeLessThan(45);
  });

  it('only once for each empty tank: again after you buy fuel', () => {
    const tilt = createTilt(), bike = empty();
    startTilt(tilt, bike, 0);
    run(tilt, bike, FUEL.tilt.seconds + 0.5);
    bike.energy = 0;
    expect(tiltBlocked(tilt, bike, 0)).toBe('used');
    bike.energy = 0.25; // a quarter tank at the station
    stepTilt(tilt, bike, 0.1);
    bike.energy = 0;
    expect(tiltBlocked(tilt, bike, 0)).toBeNull();
  });
});

describe('a nearly empty tank', () => {
  it('the petrol engine misses now and then, more often when the tank is nearly empty', () => {
    const share = (energy) => {
      const bike = { energy, sputterClock: 0 };
      let miss = 0;
      for (let i = 0; i < 2000; i++) miss += sputters(bike, 0.05) ? 1 : 0;
      return miss / 2000;
    };
    expect(share(0.5)).toBe(0);
    expect(share(FUEL.sputterAt * 0.9)).toBeGreaterThan(0.05);
    expect(share(0.01)).toBeGreaterThan(share(FUEL.sputterAt * 0.9));
    expect(share(0.01)).toBeLessThan(0.6);
  });

  it('a miss cuts the power for a moment and gives a sputter event', () => {
    const bike = createBike(world, 'petrol');
    bike.energy = 0.02;
    let sputter = 0, misses = 0;
    for (let i = 0; i < 300; i++) {
      const ev = stepBike(bike, { throttle: 1, brake: 0, steer: 0 }, world, 1 / 60);
      sputter += ev.filter((e) => e.type === 'sputter').length;
      misses += bike.misfire ? 1 : 0;
    }
    expect(sputter).toBeGreaterThan(2);
    expect(misses).toBeGreaterThan(20);
    // The electric moto does not sputter.
    const e = createBike(world, 'electric');
    e.energy = 0.02;
    for (let i = 0; i < 300; i++) stepBike(e, { throttle: 1, brake: 0, steer: 0 }, world, 1 / 60);
    expect(e.misfire).toBe(false);
  });
});
