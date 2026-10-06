import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { createBike, stepBike, forwardSpeed } from '../src/sim/bike.js';
import { contact, collideBike } from '../src/sim/collide.js';
import { repairCost } from '../src/sim/economy.js';
import { COLLISION, FUEL, BIKES } from '../src/config.js';

const DT = 1 / 120;
const straight = () => new World({ name: 'straight', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(300), '#'.repeat(300), '#'.repeat(300)] });
const ride = (bike, world, input, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...stepBike(bike, { steer: 0, throttle: 0, brake: 0, ...input }, world, DT));
  return events;
};

describe('collisions', () => {
  it('finds the contact between the bike and a turned vehicle', () => {
    const car = { kind: 'car', x: 0, y: 0, heading: 0, length: 4.2, width: 1.8, speed: 0 };
    expect(contact(car, 2.4, 0, 0.45)).toMatchObject({ nx: 1, ny: 0 });
    expect(contact(car, 3, 0, 0.45)).toBeNull();
    const turned = { ...car, heading: Math.PI / 2 };
    expect(contact(turned, 0, 2.4, 0.45).ny).toBeCloseTo(1);
  });

  it('a bike that rides into a parked car stops, bounces back and does not go through it', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    bike.autoShift = true;
    const car = { kind: 'car', x: bike.x + 18, y: bike.y, heading: 0, length: 4.2, width: 1.8, speed: 0 };
    world.dynamicAgents = [car];
    const events = ride(bike, world, { throttle: 1 }, 4);
    const hit = events.find((e) => e.type === 'wall' && e.hit === car);
    expect(hit).toBeTruthy();
    expect(bike.x).toBeLessThan(car.x - car.length / 2);
    expect(forwardSpeed(bike)).toBeLessThan(2);
  });

  it('a hard hit throws the rider off: no control for a short time', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    Object.assign(bike, { vx: 12, gear: 3 }); // 43 km/h
    world.dynamicAgents = [{ kind: 'truck', x: bike.x + 3, y: bike.y, heading: 0, length: 7, width: 2.4, speed: 0 }];
    const events = ride(bike, world, { throttle: 1 }, 0.5);
    expect(events.some((e) => e.type === 'crash')).toBe(true);
    expect(bike.crashed).toBeGreaterThan(0);
    const x = bike.x;
    ride(bike, world, { throttle: 1 }, 0.5); // throttle does nothing while you lie on the ground
    expect(Math.abs(bike.x - x)).toBeLessThan(0.5);
    ride(bike, world, { throttle: 1 }, COLLISION.crashSeconds);
    expect(bike.crashed).toBe(0);
  });

  it('a slow touch is not a crash and costs nothing', () => {
    const bike = { x: 0, y: 0, vx: 1.5, vy: 0, loadKg: 0 };
    const events = collideBike(bike, [{ kind: 'car', x: 2.5, y: 0, heading: 0, length: 4.2, width: 1.8, speed: 0 }]);
    expect(events).toHaveLength(1);
    expect(repairCost(events[0])).toBe(0);
  });

  it('a heavy vehicle pushes the bike: the truck barely slows, the bike flies back', () => {
    const truck = { kind: 'truck', x: 0, y: 0, heading: 0, length: 7, width: 2.4, speed: 8 };
    const bike = { x: 3.8, y: 0, vx: 0, vy: 0, loadKg: 0 };
    collideBike(bike, [truck]);
    expect(bike.vx).toBeGreaterThan(8); // pushed forward faster than the truck (with the bounce)
    expect(truck.speed).toBeGreaterThan(7.5);
  });

  it('a bike pushes a person aside, and a pole stops the bike', () => {
    const person = { kind: 'person', x: 0.6, y: 0, vx: 0, vy: 0 };
    const bike = { x: 0, y: 0, vx: 3, vy: 0, loadKg: 0 };
    collideBike(bike, [person]);
    expect(person.x).toBeGreaterThan(0.6);
    const pole = { kind: 'pole', x: 0.5, y: 0, radius: COLLISION.poleRadius };
    const b2 = { x: 0, y: 0, vx: 5, vy: 0, loadKg: 0 };
    collideBike(b2, [pole]);
    expect(b2.vx).toBeLessThan(0);
    expect(Math.hypot(b2.x - pole.x, b2.y - pole.y)).toBeGreaterThanOrEqual(COLLISION.poleRadius + COLLISION.bikeRadius - 1e-9);
  });

  it('a hard hit costs more than a light one', () => {
    expect(repairCost({ type: 'wall', speed: 12 })).toBeGreaterThan(repairCost({ type: 'wall', speed: 5 }));
  });
});

describe('fuel in each shift', () => {
  it('a petrol engine uses fuel at idle', () => {
    const world = straight();
    const bike = createBike(world, 'petrol');
    ride(bike, world, {}, 60);
    expect(1 - bike.energy).toBeCloseTo((60 * FUEL.idleUse) / BIKES.petrol.energySeconds, 3);
  });

  it('an electric moto uses nothing when it stands still', () => {
    const world = straight();
    const bike = createBike(world, 'electric');
    ride(bike, world, {}, 60);
    expect(bike.energy).toBe(1);
  });
});
