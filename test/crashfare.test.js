import { describe, it, expect } from 'vitest';
import { loseJobOnCrash } from '../src/sim/jobs.js';

const bike = () => ({ loadKg: 70, loadType: 'passenger' });

describe('A crash with a passenger', () => {
  it('loses the fare: the passenger gets off', () => {
    const board = { active: { id: 1, type: 'passenger', stage: 'toDropoff', pay: 3000 } };
    const b = bike();
    expect(loseJobOnCrash(board, b).pay).toBe(3000);
    expect(board.active).toBeNull();
    expect(b.loadType).toBeNull();
  });

  it('keeps cargo jobs, and jobs that are on the way to the pickup', () => {
    const cargo = { active: { type: 'cargo', stage: 'toDropoff' } };
    expect(loseJobOnCrash(cargo, bike())).toBeNull();
    expect(cargo.active).not.toBeNull();
    const pickup = { active: { type: 'passenger', stage: 'toPickup' } };
    expect(loseJobOnCrash(pickup, bike())).toBeNull();
    expect(loseJobOnCrash({ active: null }, bike())).toBeNull();
  });
});
