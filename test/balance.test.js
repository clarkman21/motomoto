import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { levelReport, sampleJobs, dayEstimate } from '../src/sim/balance.js';
import { startAtLevel, levelSettings } from '../src/sim/levels.js';
import { createWallet } from '../src/sim/economy.js';
import { BALANCE, LEVELS } from '../src/config.js';

const world = new World(buildKigaliMap());
const rows = levelReport(world);
const row = (level, player) => rows.find((r) => r.level === level && r.player === player);

describe('balance: can the levels be passed?', () => {
  it('an average player passes each level in a few days', () => {
    for (const [i, max] of BALANCE.targetDaysAverage.entries()) {
      const r = row(i + 1, 'average');
      expect(r.profit, `level ${i + 1}`).toBeGreaterThan(0);
      expect(r.days, `level ${i + 1}`).toBeLessThanOrEqual(max);
    }
  });

  it('a good player is faster than an average player, and a beginner is slower', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(row(n, 'good').profit).toBeGreaterThan(row(n, 'average').profit);
      expect(row(n, 'average').profit).toBeGreaterThan(row(n, 'beginner').profit);
    }
  });

  it('a beginner on level 1 loses only a little each day (time to learn before the cash runs out)', () => {
    expect(row(1, 'beginner').profit).toBeGreaterThan(-BALANCE.beginnerMaxLossPerDay);
  });

  it('fines and crashes cost money in the model', () => {
    const level = LEVELS[0];
    const jobs = sampleJobs(world, level, 50);
    const clean = dayEstimate(level, jobs, { ...BALANCE.players.average, finesPerDay: 0, crashesPerDay: 0 });
    expect(clean.profit).toBeGreaterThan(dayEstimate(level, jobs, BALANCE.players.average).profit);
  });
});

describe('test mode: start a new game at a later level', () => {
  it('starts at the level with the perks of the milestones before it', () => {
    const w = startAtLevel(createWallet(), 5);
    expect(w.level).toBe(5);
    expect(w.perks.electric).toBe(true);
    expect(w.perks.phone).toBe(true);
    expect(levelSettings(w).bikeType).toBe('electric');
    expect(startAtLevel(createWallet(), 1).milestones.length).toBe(0);
  });
});
