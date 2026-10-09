import { describe, it, expect } from 'vitest';
import { SHOP } from '../src/config.js';
import { createWallet } from '../src/sim/economy.js';
import { startAtLevel } from '../src/sim/levels.js';
import { shopItems, buyPart, partEffects, partsTip } from '../src/sim/shop.js';
import { World } from '../src/world/world.js';
import { createBike, stepBike } from '../src/sim/bike.js';

const rich = (level) => Object.assign(startAtLevel(createWallet(), level), { cash: 200000 });

describe('garage shop: parts and upgrades', () => {
  it('opens parts level by level, and keeps petrol engine parts off the electric moto', () => {
    const l1 = shopItems(rich(1), 'petrol');
    expect(l1.every((i) => i.locked)).toBe(true); // level 1: nothing yet
    const l3 = shopItems(rich(3), 'petrol');
    expect(l3.find((i) => i.id === 'speaker').canBuy).toBe(true);
    expect(l3.find((i) => i.id === 'bearings').locked).toBe(true);
    const l5 = shopItems(rich(5), 'electric');
    expect(l5.find((i) => i.id === 'chain').fits).toBe(false);
    expect(l5.find((i) => i.id === 'regen').canBuy).toBe(true);
  });

  it('buying takes the cash once, goes on the day bill, and cannot happen twice', () => {
    const w = rich(3);
    const cash = w.cash;
    expect(buyPart(w, 'speaker', 'petrol').ok).toBe(true);
    expect(w.cash).toBe(cash - SHOP.items.find((i) => i.id === 'speaker').price);
    expect(w.ledger.costs.parts).toBe(SHOP.items.find((i) => i.id === 'speaker').price);
    expect(buyPart(w, 'speaker', 'petrol')).toEqual({ ok: false, reason: 'owned' });
    expect(buyPart(Object.assign(rich(3), { cash: 100 }), 'tyres', 'petrol').reason).toBe('cash');
    expect(buyPart(rich(2), 'tyres', 'petrol').reason).toBe('locked');
    expect(buyPart(rich(5), 'filter', 'electric').reason).toBe('fits');
  });

  it('effects combine, and parts that do not fit the moto do nothing', () => {
    const w = rich(5);
    w.parts = ['chain', 'pads', 'bearings', 'speaker', 'charger'];
    const petrol = partEffects(w, 'petrol'), electric = partEffects(w, 'electric');
    expect(petrol.wear).toBeCloseTo(0.8 * 0.9 * 0.85);
    expect(electric.wear).toBeCloseTo(0.9 * 0.85); // the chain kit stays with the petrol moto
    const job = { type: 'passenger', pay: 5000, comfort: 100, gameKm: 6 };
    expect(partsTip(job, petrol)).toBe(750); // 10% + 5% (a long trip) of the fare
    expect(partsTip({ ...job, gameKm: 2 }, petrol)).toBe(500);
    expect(partsTip({ ...job, type: 'cargo' }, petrol)).toBe(0);
  });

  it('a chain kit makes the service meter fill slower', () => {
    const world = new World({ name: 'w', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(200), '#'.repeat(200), '#'.repeat(200)], hills: [] });
    const ride = (mods) => {
      const bike = createBike(world);
      bike.autoShift = true;
      bike.mods = mods;
      for (let t = 0; t < 8; t += 1 / 60) stepBike(bike, { steer: 0, throttle: 0.7, brake: 0 }, world, 1 / 60);
      return bike.serviceWear;
    };
    const w = rich(3);
    w.parts = ['chain'];
    expect(ride(partEffects(w, 'petrol'))).toBeLessThan(ride(undefined) * 0.85);
  });
});
