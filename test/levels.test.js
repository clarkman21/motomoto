import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { createWallet, endDay, fuelFillCost } from '../src/sim/economy.js';
import { levelDef, levelSettings, milestoneReady, buyMilestone, restartLevel, savingsTarget, streakMultiplier, updateStreak, districtsForLevel } from '../src/sim/levels.js';
import { createJobBoard, makeOffer, mulberry32 } from '../src/sim/jobs.js';
import { createBike } from '../src/sim/bike.js';
import { LEVELS, SAVINGS_FLOAT, MONEY, STREAK } from '../src/config.js';

const world = new World(buildKigaliMap());

describe('levels', () => {
  it('has the first four levels from the spec, then free play', () => {
    expect(LEVELS.slice(0, 4).map((l) => l.goal)).toEqual([15000, 25000, 40000, 60000]);
    expect(levelDef(5).freePlay).toBe(true);
    expect(levelDef(1).shift).toEqual({ start: 19, end: 23, realSeconds: 180 });
  });

  it('a milestone needs the goal plus the working float', () => {
    const w = createWallet(15000 + SAVINGS_FLOAT - 10);
    expect(milestoneReady(w)).toBe(false);
    w.cash += 10;
    expect(savingsTarget(w)).toBe(15000 + SAVINGS_FLOAT);
    expect(milestoneReady(w)).toBe(true);
  });

  it('buying a milestone spends the goal and starts the next level', () => {
    const w = createWallet(15000 + SAVINGS_FLOAT);
    const bought = buyMilestone(w);
    expect(bought.milestone).toBe('School fees for one term');
    expect(w.cash).toBe(SAVINGS_FLOAT);
    expect(w.level).toBe(2);
    expect(w.milestones).toHaveLength(1);
  });

  it('level 2 gives a smartphone (one more job card), level 4 the electric moto', () => {
    const w = createWallet(0);
    w.level = 2;
    w.cash = 25000 + SAVINGS_FLOAT;
    buyMilestone(w);
    expect(levelSettings(w).maxOffers).toBe(4);
    expect(levelSettings(w).bikeType).toBe('petrol');
    w.level = 4;
    w.cash = 60000 + SAVINGS_FLOAT;
    buyMilestone(w);
    expect(w.level).toBe(5);
    expect(levelSettings(w).bikeType).toBe('electric');
  });

  it('free play (level 5) has no milestone to buy yet', () => {
    const w = createWallet(1e6);
    w.level = 5;
    expect(milestoneReady(w)).toBe(false);
    expect(buyMilestone(w)).toBeNull();
  });

  it('game over restarts the current level only', () => {
    const w = createWallet(-9000);
    w.level = 3;
    w.perks.phone = true;
    w.loansTaken = 1;
    restartLevel(w);
    expect(w).toMatchObject({ cash: MONEY.startCash, level: 3, loansTaken: 0, loan: null });
    expect(w.perks.phone).toBe(true);
  });

  it('gets harder: more traffic, more rivals, faster offers, dearer petrol', () => {
    for (let i = 1; i < 4; i++) {
      const a = levelDef(i), b = levelDef(i + 1);
      expect(b.traffic).toBeGreaterThanOrEqual(a.traffic);
      expect(b.rivals).toBeGreaterThan(a.rivals);
      expect(b.raceChance).toBeGreaterThan(a.raceChance);
      expect(b.offerLife[1]).toBeLessThan(a.offerLife[1]);
      expect(b.petrol).toBeGreaterThanOrEqual(a.petrol);
      expect(b.goal).toBeGreaterThan(a.goal);
    }
  });
});

describe('level settings in the game rules', () => {
  it('level 1 offers Nyabugogo jobs only; the map grows with the levels', () => {
    expect(districtsForLevel(1)).toEqual(['nyabugogo']);
    expect(districtsForLevel(2)).toEqual(['nyabugogo', 'town']);
    expect(districtsForLevel(3)).toHaveLength(4);
    expect(districtsForLevel(4)).toContain('kicukiro');
    expect(districtsForLevel(5)).toHaveLength(6);
    const rng = mulberry32(3);
    const valley = Array.from({ length: 40 }, (_, i) => makeOffer(world, rng, i, { districts: districtsForLevel(1) }));
    for (const o of valley) {
      expect(o.from.district).toBe('nyabugogo');
      expect(o.to.district).toBe('nyabugogo');
    }
    const withTown = Array.from({ length: 80 }, (_, i) => makeOffer(world, rng, i, { districts: districtsForLevel(2) }));
    expect(withTown.some((o) => o.to.district === 'town' || o.from.district === 'town')).toBe(true);
  });

  it('the bus park starts the most jobs', () => {
    const rng = mulberry32(5);
    const offers = Array.from({ length: 300 }, (_, i) => makeOffer(world, rng, i, { districts: ['nyabugogo'] }));
    const count = (id) => offers.filter((o) => o.from.id === id).length;
    expect(count('busPark')).toBeGreaterThan(count('riverRoad') * 2);
  });

  it('the fare multiplier raises the pay', () => {
    const a = makeOffer(world, mulberry32(9), 1, { districts: ['nyabugogo'] });
    const b = makeOffer(world, mulberry32(9), 1, { districts: ['nyabugogo'], fareMultiplier: 1.2 });
    expect(b.pay).toBeGreaterThan(a.pay * 1.15);
  });

  it('the board uses the number of job cards from the level', () => {
    expect(createJobBoard(world, 1, { maxOffers: 4, districts: ['nyabugogo'] }).offers).toHaveLength(4);
  });

  it('the petrol price and the rent follow the level', () => {
    const bike = createBike(world, 'petrol');
    bike.energy = 0.5;
    expect(fuelFillCost(bike, 1.2)).toBe(MONEY.fuelFullTank * 0.5 * 1.2);
    expect(endDay(createWallet(10000), bike, 3000).costs.rent).toBe(3000);
  });

  it('the clean ride streak raises fares up to the maximum and resets', () => {
    const w = createWallet();
    for (let i = 0; i < 10; i++) updateStreak(w, true);
    expect(streakMultiplier(w)).toBeCloseTo(STREAK.max);
    updateStreak(w, false);
    expect(streakMultiplier(w)).toBe(1);
  });
});
