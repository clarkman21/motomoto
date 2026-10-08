import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { createBike, stepBike, forwardSpeed, energyUse, shiftGear, resetToRoad, revsFuelFactor } from '../src/sim/bike.js';
import { BIKES, SURFACES, MAINTENANCE, GEARBOX, FUEL, JOBS } from '../src/config.js';

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

  it('uses about a quarter of a petrol tank per minute at full throttle (more at high revs)', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    bike.autoShift = true;
    run(bike, world, { throttle: 1 }, 60);
    const perMinute = 60 / BIKES.petrol.energySeconds;
    expect(1 - bike.energy).toBeGreaterThan(perMinute);
    expect(1 - bike.energy).toBeLessThan(perMinute * 1.35);
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
    expect(low.brakeWearKm).toBe(0); // engine braking does not wear the brakes
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
  const stopFrom = (type, kmhStart, brake, due = 0) => {
    const world = straight();
    const bike = createBike(world, type);
    bike.gear = 3;
    bike.serviceWear = due * MAINTENANCE.intervalKm[type];
    bike.vx = kmhStart / 3.6;
    bike.energy = 0.5;
    const x0 = bike.x;
    for (let t = 0; t < 10 && forwardSpeed(bike) > 0.1; t += DT) stepBike(bike, { steer: 0, throttle: 0, brake }, world, DT);
    return { bike, distance: bike.x - x0 };
  };

  it('a hard stop from 60 km/h adds about 0.5 km to the service meter (the brake pads)', () => {
    const { bike } = stopFrom('petrol', 60, 1);
    expect(bike.brakeWearKm).toBeGreaterThan(0.3);
    expect(bike.brakeWearKm).toBeLessThan(0.7);
    expect(bike.serviceWear).toBeGreaterThanOrEqual(bike.brakeWearKm);
  });

  it('a bike that is long overdue for a service needs a longer distance to stop', () => {
    expect(stopFrom('petrol', 50, 1, 1.49).distance).toBeGreaterThan(stopFrom('petrol', 50, 1, 0).distance * 1.4);
    expect(stopFrom('petrol', 50, 1, 0.9).distance).toBeLessThan(stopFrom('petrol', 50, 1, 0).distance * 1.01);
  });

  it('electric regen braking charges the battery and saves the pads', () => {
    const { bike } = stopFrom('electric', 60, 0.3); // gentle: regen does the work down to 1 m/s
    expect(bike.brakeWearKm).toBeLessThan(0.01);
    expect(bike.energy).toBeGreaterThan(0.5);
  });

  it('hard electric braking uses the friction brakes too, but wears them less than petrol', () => {
    const e = stopFrom('electric', 60, 1).bike;
    const p = stopFrom('petrol', 60, 1).bike;
    expect(e.brakeWearKm).toBeGreaterThan(0);
    expect(e.brakeWearKm).toBeLessThan(p.brakeWearKm * 0.8);
  });
});

describe('hills and dirt make the engine work harder', () => {
  // A long climb along +x. run = tiles per level: 2 = 19% grade, 1.5 = 25%.
  const climb = (ch, run) =>
    new World({ name: 'climb', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: [ch.repeat(400), ch.repeat(400), ch.repeat(400)],
      hills: [{ x0: 2000, y0: -10, x1: 3000, y1: 20, level: 2000 / run, run: { west: run, east: 1, north: 1, south: 1 } }] });
  const holdThrottle = (world, type, gear, seconds = 20) => {
    const bike = createBike(world, type);
    bike.gear = gear;
    bike.vx = 25 / 3.6;
    const events = run(bike, world, { throttle: 1 }, seconds);
    return { bike, events };
  };

  it('on a 19% tarmac climb, 4th gear cannot hold speed but 2nd gear can', () => {
    expect(kmh(holdThrottle(climb('#', 2), 'petrol', 3).bike)).toBeLessThan(5);
    expect(kmh(holdThrottle(climb('#', 2), 'petrol', 1).bike)).toBeGreaterThan(30);
  });

  it('on a 25% murram climb, only 1st gear climbs', () => {
    expect(kmh(holdThrottle(climb('m', 1.5), 'petrol', 1).bike)).toBeLessThan(5);
    expect(kmh(holdThrottle(climb('m', 1.5), 'petrol', 0).bike)).toBeGreaterThan(15);
  });

  it('warns the rider to shift down when the engine struggles', () => {
    const { events } = holdThrottle(climb('#', 2), 'petrol', 3, 5);
    expect(events.some((e) => e.type === 'lugging')).toBe(true);
  });

  it('murram slows a coasting bike faster than tarmac', () => {
    const coast = (ch) => {
      const world = straight(ch);
      const bike = createBike(world, 'electric');
      bike.vx = 40 / 3.6;
      run(bike, world, {}, 3);
      return kmh(bike);
    };
    expect(coast('m')).toBeLessThan(coast('#') - 5);
  });

  it('the electric moto climbs without gears but uses more energy on a dirt hill', () => {
    const flat = holdThrottle(straight('#'), 'electric', 0);
    const hill = holdThrottle(climb('m', 2), 'electric', 0);
    expect(kmh(hill.bike)).toBeGreaterThan(35);
    expect(1 - hill.bike.energy).toBeGreaterThan((1 - flat.bike.energy) * 1.6);
  });
});

describe('climbing with a load', () => {
  const steep = () =>
    new World({ name: 'steep', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(400), '#'.repeat(400), '#'.repeat(400)],
      hills: [{ x0: 2000, y0: -10, x1: 3000, y1: 20, level: 2000, run: { west: 1, east: 1, north: 1, south: 1 } }] });

  it('a petrol moto with a passenger still climbs a 37% ramp in 1st gear, slowly', () => {
    const world = steep();
    const bike = createBike(world, 'petrol');
    bike.loadKg = 65;
    run(bike, world, { throttle: 1 }, 10);
    expect(kmh(bike)).toBeGreaterThan(3);
    expect(kmh(bike)).toBeLessThan(22);
  });

  it('an electric moto with a passenger climbs the same ramp faster', () => {
    const world = steep();
    const p = createBike(world, 'petrol');
    const e = createBike(world, 'electric');
    p.loadKg = e.loadKg = 65;
    run(p, world, { throttle: 1 }, 6);
    run(e, world, { throttle: 1 }, 6);
    expect(e.x).toBeGreaterThan(p.x + 4);
  });
});

describe('reset (R)', () => {
  it('puts the bike on the nearest road and keeps fuel, wear and the load', () => {
    const world = new World({ name: 'reset', start: { x: 1.5, y: 0.5, headingDeg: 0 }, rows: ['#####', '.....', '.....', '.....'] });
    const bike = createBike(world, 'petrol');
    Object.assign(bike, { x: 2.5 * 4, y: 3.5 * 4, vx: 3, energy: 0.2, brakeWearKm: 4, serviceWear: 90, loadKg: 60, brokenDown: true });
    expect(resetToRoad(world, bike)).toBe(true);
    expect(world.tileAt(bike.x, bike.y).surface).toBe('tarmac');
    expect(bike.y).toBe(0.5 * 4);
    expect(bike.vx).toBe(0);
    expect(bike).toMatchObject({ energy: 0.2, brakeWearKm: 4, serviceWear: 90, loadKg: 60, brokenDown: true });
  });
});

describe('standing at a station', () => {
  it('the brake holds the bike still and does not walk it backwards', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    const x0 = bike.x;
    run(bike, world, { brake: 1, hold: true }, 5);
    expect(Math.abs(bike.x - x0)).toBeLessThan(0.05);
    // Without hold (the rider holds the brake at a stop) the bike walks back, as before.
    run(bike, world, { brake: 1 }, 2);
    expect(bike.x).toBeLessThan(x0 - 0.3);
  });
});

describe('pushing the bike (no fuel)', () => {
  const pushOn = (ch, hills = []) => {
    const world = straight(ch, hills);
    const bike = createBike(world, 'petrol');
    bike.energy = 0;
    const x0 = bike.x;
    run(bike, world, { throttle: 1 }, 6);
    return { moved: bike.x - x0, kmh: kmh(bike) };
  };

  it('works on tarmac, grass and wet murram, at walking speed', () => {
    for (const ch of ['#', '.', 'w']) {
      const { moved, kmh: k } = pushOn(ch);
      expect(moved).toBeGreaterThan(3);
      expect(k).toBeLessThan(5);
    }
  });

  it('works up a gentle hill, a little slower', () => {
    const flat = pushOn('#').moved;
    // A ramp of 1.5 m over 8 m (about 19%) that starts under the bike.
    const hills = [{ x0: 3, y0: 0, x1: 300, y1: 3, level: 1, run: { west: 2 } }];
    const world = straight('#', hills);
    const probe = createBike(world, 'petrol');
    probe.x = 2 * 4;
    run(probe, world, {}, 0.05);
    expect(probe.grade).toBeGreaterThan(0.1);
    const bike = createBike(world, 'petrol');
    Object.assign(bike, { x: 1.8 * 4, energy: 0 });
    const x0 = bike.x;
    run(bike, world, { throttle: 1 }, 6);
    const up = { moved: bike.x - x0 };
    expect(up.moved).toBeGreaterThan(2);
    expect(up.moved).toBeLessThanOrEqual(flat + 0.01);
  });
});

describe('fuel and shifting (petrol)', () => {
  const long = new World({ name: 'long', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(2000), '#'.repeat(2000), '#'.repeat(2000)] });
  // One minute of stop and go riding: 12 s full throttle, then coast and brake. shiftAt: the revs to shift up at.
  const ride = (shiftAt) => {
    const b = createBike(long, 'petrol');
    const x0 = b.x;
    const events = [];
    for (let t = 0; t < 60; t += 1 / 120) {
      const phase = t % 15;
      if (b.revs > shiftAt && b.gear < BIKES.petrol.gears.length) shiftGear(b, 1);
      if (b.revs < 0.3 && b.gear > 1) shiftGear(b, -1);
      events.push(...stepBike(b, { throttle: phase < 12 ? 1 : 0, brake: phase >= 13 ? 0.6 : 0, steer: 0 }, long, 1 / 120));
    }
    return { perKm: (1 - b.energy) / ((b.x - x0) / 1000), events };
  };

  it('low revs save fuel; the red zone and lugging waste it', () => {
    expect(revsFuelFactor(0.6, 3)).toBeLessThan(0.85);
    expect(revsFuelFactor(1, 3)).toBeGreaterThan(1.4);
    expect(revsFuelFactor(0.1, 3)).toBeGreaterThan(revsFuelFactor(0.3, 3)); // lugging in a high gear
    expect(revsFuelFactor(0.1, 1)).toBeLessThan(revsFuelFactor(0.3, 1)); // first gear does not lug
  });

  it('good shifting goes much further on the same fuel than staying in first gear', () => {
    const good = ride(GEARBOX.ecoRevs - 0.05).perKm;
    const first = ride(9).perKm;
    expect(first).toBeGreaterThan(good * 3);
  });

  it('the start tank is enough for a few jobs with good shifting', () => {
    const { perKm } = ride(GEARBOX.ecoRevs - 0.05);
    const gameKm = (FUEL.startLevel / perKm) * 1000 / JOBS.gameKmMetres;
    expect(gameKm).toBeGreaterThan(60); // about 10 jobs of 6 game km on the flat (fewer with hills and loads)
  });

  it('a long time in the red zone gives a hint to shift up, but not too often', () => {
    const red = ride(9).events.filter((e) => e.type === 'redZone');
    expect(red.length).toBeGreaterThan(0);
    expect(red.length).toBeLessThanOrEqual(Math.ceil(60 / GEARBOX.redWarnEverySeconds));
    expect(ride(GEARBOX.ecoRevs - 0.05).events.some((e) => e.type === 'redZone')).toBe(false);
  });
});

describe('running out of fuel while riding', () => {
  it('the bike rolls on and slows down slowly (no engine braking), then stops', () => {
    const world = straight();
    const ride = (energy) => {
      const bike = createBike(world, 'petrol');
      bike.vx = 50 / 3.6; // 50 km/h in third gear
      bike.gear = 2;
      bike.energy = energy;
      run(bike, world, { throttle: 0 }, 2);
      return kmh(bike);
    };
    const dead = ride(0), running = ride(1);
    expect(dead).toBeGreaterThan(running); // a running engine brakes the bike harder
    expect(dead).toBeGreaterThan(35); // after 2 s it still rolls
    const bike = createBike(world, 'petrol');
    bike.vx = 50 / 3.6;
    bike.energy = 0;
    run(bike, world, { throttle: 0 }, 30);
    expect(kmh(bike)).toBeLessThan(1);
  });
});
