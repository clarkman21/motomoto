import { describe, it, expect } from 'vitest';
import { RIDER } from '../src/config.js';
import { createRider, stepRider, riderPower, canEat, eat, drainRate } from '../src/sim/rider.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';

describe('rider energy (hard mode)', () => {
  it('a short night shift needs no food, a full day shift needs a meal', () => {
    const night = createRider();
    stepRider(night, 19, 4); // 19:00 to 23:00
    expect(night.energy).toBeGreaterThan(RIDER.hungryAt);
    const day = createRider();
    const events = stepRider(day, 6, 16); // 06:00 to 22:00
    expect(day.energy).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['hungry', 'weak']);
  });

  it('a hungry rider has less power, a weak rider the least', () => {
    expect(riderPower(createRider())).toBe(1);
    expect(riderPower({ energy: RIDER.hungryAt - 0.01 })).toBeLessThan(1);
    expect(riderPower({ energy: 0 })).toBe(RIDER.weakPower);
    expect(riderPower(null)).toBe(1);
  });

  it('buffets serve lunch only at lunch time; ikivuguto fills the most and lasts', () => {
    const r = { ...createRider(), energy: 0.2 };
    expect(canEat(r, 'buffet', 9).ok).toBe(false);
    expect(canEat(r, 'buffet', 12).ok).toBe(true);
    expect(RIDER.foods.ikivuguto.energy).toBeGreaterThan(RIDER.foods.buffet.energy);
    eat(r, 'ikivuguto', 12);
    expect(drainRate(r, 13)).toBeLessThan(drainRate(r, 16));
    expect(canEat({ energy: 1 }, 'bananas', 12).reason).toBe('full');
  });

  it('an energy drink is quick, but the energy goes down faster for an hour', () => {
    const r = { ...createRider(), energy: 0.3 };
    eat(r, 'drink', 14);
    expect(r.energy).toBeCloseTo(0.3 + RIDER.foods.drink.energy);
    expect(drainRate(r, 14.5)).toBeGreaterThan(drainRate(r, 15.5));
  });

  it('the map has buffets and milk bars to eat at', () => {
    const world = new World(buildKigaliMap());
    expect(world.placesWithTag('buffet').length).toBeGreaterThanOrEqual(5);
    expect(world.placesWithTag('milk').length).toBeGreaterThanOrEqual(3);
  });
});
