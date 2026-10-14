import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { createBike, stepBike } from '../src/sim/bike.js';

// A big field of wet murram ('w'), so the bike can turn in circles.
const field = (c) => new World({ name: 'wet', start: { x: 30.5, y: 30.5, headingDeg: 0 }, rows: Array.from({ length: 60 }, () => c.repeat(60)), hills: [] });

/** Ride at kmh, then hold a full turn for seconds. Returns the events. */
function turnAt(world, kmh, seconds, wetGrip = 0) {
  const bike = createBike(world, 'electric');
  bike.mods = { wetGrip };
  const v = kmh / 3.6;
  bike.vx = Math.cos(bike.heading) * v;
  bike.vy = Math.sin(bike.heading) * v;
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 120) events.push(...stepBike(bike, { throttle: 0.6, brake: 0, steer: 1 }, world, 1 / 120));
  return events;
}

describe('Wet murram', () => {
  it('a hard turn at speed makes the bike slide, then fall', () => {
    const ev = turnAt(field('w'), 32, 1.5);
    expect(ev.some((e) => e.type === 'slide')).toBe(true);
    expect(ev.some((e) => e.type === 'crash' && e.slip)).toBe(true);
  });

  it('a slow turn is safe; so is the same turn on dry murram or tarmac', () => {
    expect(turnAt(field('w'), 8, 1.5).some((e) => e.type === 'slide' || e.type === 'crash')).toBe(false);
    expect(turnAt(field('m'), 32, 1.5).some((e) => e.type === 'crash' && e.slip)).toBe(false);
    expect(turnAt(field('#'), 32, 1.5).some((e) => e.type === 'slide')).toBe(false);
  });
});
