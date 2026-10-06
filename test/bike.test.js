import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { createBike, stepBike, forwardSpeed, energyUse, shiftGear } from '../src/sim/bike.js';
import { BIKES, SURFACES } from '../src/config.js';

const DT = 1 / 120;
const run = (bike, world, input, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...stepBike(bike, { steer: 0, throttle: 0, brake: 0, ...input }, world, DT));
  return events;
};
const kmh = (bike) => forwardSpeed(bike) * 3.6;

// A long straight road along +x, 3 tiles wide.
const straight = (ch = '#', hills = []) =>
  new World({ name: 'straight', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: [ch.repeat(300), ch.repeat(300), ch.repeat(300)], hills });

describe('bike on flat tarmac', () => {
  it('reaches close to its top speed', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    bike.autoShift = true;
    run(bike, world, { throttle: 1 }, 40);
    expect(kmh(bike)).toBeGreaterThan(60);
    expect(kmh(bike)).toBeLessThanOrEqual(70);
  });

  it('electric accelerates faster than petrol', () => {
    const world = straight();
    const p = createBike(world, 'petrol');
    const e = createBike(world, 'electric');
    run(p, world, { throttle: 1 }, 3);
    run(e, world, { throttle: 1 }, 3);
    expect(kmh(e)).toBeGreaterThan(kmh(p) + 5);
  });

  it('brakes to a stop', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    run(bike, world, { throttle: 1 }, 6);
    run(bike, world, { brake: 1 }, 4);
    expect(Math.abs(kmh(bike))).toBeLessThan(5);
  });

  it('uses about one sixth of a petrol tank per minute at full throttle (more at high revs)', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    bike.autoShift = true;
    run(bike, world, { throttle: 1 }, 60);
    expect(1 - bike.energy).toBeGreaterThan(1 / 6);
    expect(1 - bike.energy).toBeLessThan(1 / 6 * 1.35);
  });
});

describe('bike on slow surfaces', () => {
  it('is slower on murram than on tarmac', () => {
    const tar = straight('#');
    const mur = straight('m');
    const a = createBike(tar);
    const b = createBike(mur);
    a.autoShift = b.autoShift = true;
    run(a, tar, { throttle: 1 }, 20);
    run(b, mur, { throttle: 1 }, 20);
    expect(kmh(b)).toBeLessThan(kmh(a) * 0.8);
    expect(b.energy).toBeLessThan(a.energy);
  });

  it('slides longer on wet murram after a turn', () => {
    const lateralAfterTurn = (ch) => {
      const world = straight(ch);
      const bike = createBike(world);
      bike.vx = 12; // 43 km/h along +x
      bike.heading = 0.6; // turn sharply without changing velocity
      stepBike(bike, { steer: 0, throttle: 0, brake: 0 }, world, 0.1);
      const fwd = forwardSpeed(bike);
      return Math.hypot(bike.vx, bike.vy) ** 2 - fwd ** 2;
    };
    expect(lateralAfterTurn('w')).toBeGreaterThan(lateralAfterTurn('#') * 2);
  });
});

describe('bike on hills', () => {
  // A 37% ramp up along +x from tile 20 to 24, then a plateau.
  const rampWorld = () => straight('#', [{ x0: 24, y0: -10, x1: 400, y1: 20, level: 4, run: { west: 1, east: 1, north: 1, south: 1 } }]);

  it('petrol can climb the steep ramp from a standstill', () => {
    const world = rampWorld();
    const bike = createBike(world, 'petrol');
    bike.x = 21 * 4;
    run(bike, world, { throttle: 1 }, 4);
    expect(bike.grade).toBeGreaterThan(0.3);
    expect(kmh(bike)).toBeGreaterThan(3);
  });

  it('rolls back when you stop on a climb', () => {
    const world = rampWorld();
    const bike = createBike(world, 'petrol');
    bike.x = 22 * 4;
    run(bike, world, {}, 1);
    expect(kmh(bike)).toBeLessThan(0);
  });

  it('electric climbs faster than petrol', () => {
    const world = rampWorld();
    const p = createBike(world, 'petrol');
    const e = createBike(world, 'electric');
    p.x = e.x = 20.2 * 4;
    run(p, world, { throttle: 1 }, 3);
    run(e, world, { throttle: 1 }, 3);
    expect(e.x).toBeGreaterThan(p.x);
  });

  it('electric regen refills the battery downhill', () => {
    const world = rampWorld();
    const bike = createBike(world, 'electric');
    bike.x = 24 * 4;
    bike.heading = Math.PI; // facing down the ramp
    bike.vx = -8;
    bike.energy = 0.5;
    run(bike, world, {}, 1);
    expect(bike.energy).toBeGreaterThan(0.5);
  });
});

describe('energyUse', () => {
  it('follows the spec uphill factors', () => {
    const flat = energyUse(BIKES.petrol, SURFACES.tarmac, 0, 1, 10, 19);
    expect(energyUse(BIKES.petrol, SURFACES.tarmac, 0.3, 1, 10, 19)).toBeCloseTo(flat * 2.0);
    expect(energyUse(BIKES.petrol, SURFACES.tarmac, -0.3, 1, 10, 19)).toBeCloseTo(flat * 0.5);
    const eFlat = energyUse(BIKES.electric, SURFACES.tarmac, 0, 1, 10, 21);
    expect(energyUse(BIKES.electric, SURFACES.tarmac, 0.3, 1, 10, 21)).toBeCloseTo(eFlat * 1.6);
  });
});

describe('hazards and walls', () => {
  it('a pothole cuts speed by 30%', () => {
    const world = new World({ name: 'p', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(10), '###o######', '#'.repeat(10)], hills: [] });
    const bike = createBike(world);
    bike.vx = 10;
    const events = run(bike, world, {}, 0.8);
    expect(events.some((e) => e.type === 'pothole')).toBe(true);
    expect(forwardSpeed(bike)).toBeLessThan(7.2);
  });

  it('does not drive into a building', () => {
    const world = new World({ name: 'b', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['######', '####4#', '######'], hills: [] });
    const bike = createBike(world);
    const events = run(bike, world, { throttle: 1 }, 5);
    expect(bike.x).toBeLessThan(4 * 4);
    expect(events.some((e) => e.type === 'wall')).toBe(true);
  });
});

describe('gearbox (petrol)', () => {
  it('first gear tops out at its rev limit', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    run(bike, world, { throttle: 1 }, 10);
    expect(kmh(bike)).toBeGreaterThan(18);
    expect(kmh(bike)).toBeLessThanOrEqual(22.1);
    expect(bike.revs).toBeGreaterThan(0.9);
  });

  it('a start in third gear is slow (the engine lugs)', () => {
    const world = straight();
    const first = createBike(world, 'petrol');
    const third = createBike(world, 'petrol');
    third.gear = 2;
    run(first, world, { throttle: 1 }, 2);
    run(third, world, { throttle: 1 }, 2);
    expect(kmh(third)).toBeLessThan(kmh(first) * 0.6);
  });

  it('refuses a downshift that would over-rev the engine', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    bike.gear = 3;
    bike.vx = 50 / 3.6;
    expect(shiftGear(bike, -1)).toEqual({ type: 'shift', gear: 2 });
    expect(shiftGear(bike, -1)).toEqual({ type: 'overRev' });
    expect(bike.gear).toBe(2);
  });

  it('the electric moto has no gears', () => {
    const world = straight();
    expect(shiftGear(createBike(world, 'electric'), 1)).toEqual({ type: 'noGears' });
  });

  it('a lower gear gives more engine braking', () => {
    const world = straight();
    const low = createBike(world, 'petrol');
    const high = createBike(world, 'petrol');
    low.gear = 1;
    high.gear = 3;
    low.vx = high.vx = 35 / 3.6;
    run(low, world, {}, 2);
    run(high, world, {}, 2);
    expect(kmh(low)).toBeLessThan(kmh(high) - 5);
    expect(low.brakePads).toBe(1); // engine braking does not wear the brakes
  });

  it('an early upshift uses less fuel than high revs', () => {
    const world = straight();
    const revving = createBike(world, 'petrol');
    const shortShift = createBike(world, 'petrol');
    revving.gear = 1;
    shortShift.gear = 3;
    revving.vx = shortShift.vx = 30 / 3.6;
    // Hold about 30 km/h for 20 s in each gear.
    for (let t = 0; t < 20; t += DT) {
      for (const b of [revving, shortShift]) stepBike(b, { steer: 0, throttle: kmh(b) < 30 ? 1 : 0, brake: 0 }, world, DT);
    }
    expect(1 - shortShift.energy).toBeLessThan((1 - revving.energy) * 0.85);
  });
});

describe('brakes', () => {
  const stopFrom = (type, kmhStart, brake, pads = 1) => {
    const world = straight();
    const bike = createBike(world, type);
    bike.gear = 3;
    bike.brakePads = pads;
    bike.vx = kmhStart / 3.6;
    bike.energy = 0.5;
    const x0 = bike.x;
    for (let t = 0; t < 10 && forwardSpeed(bike) > 0.1; t += DT) stepBike(bike, { steer: 0, throttle: 0, brake }, world, DT);
    return { bike, distance: bike.x - x0 };
  };

  it('petrol brakes wear about 1% for a hard stop from 60 km/h', () => {
    const { bike } = stopFrom('petrol', 60, 1);
    expect(1 - bike.brakePads).toBeGreaterThan(0.005);
    expect(1 - bike.brakePads).toBeLessThan(0.012);
  });

  it('worn brakes need a longer distance to stop', () => {
    expect(stopFrom('petrol', 50, 1, 0).distance).toBeGreaterThan(stopFrom('petrol', 50, 1, 1).distance * 1.4);
  });

  it('electric regen braking charges the battery and saves the pads', () => {
    const { bike } = stopFrom('electric', 60, 0.3); // gentle: regen does the work down to 1 m/s
    expect(bike.brakePads).toBeGreaterThan(0.9999);
    expect(bike.energy).toBeGreaterThan(0.5);
  });

  it('hard electric braking uses the friction brakes too, but wears them less than petrol', () => {
    const e = stopFrom('electric', 60, 1).bike;
    const p = stopFrom('petrol', 60, 1).bike;
    expect(e.brakePads).toBeLessThan(1);
    expect(1 - e.brakePads).toBeLessThan((1 - p.brakePads) * 0.8);
  });
});
