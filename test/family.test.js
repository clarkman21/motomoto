import { describe, it, expect } from 'vitest';
import { needFor, deliveryLine, dayEndStory, gameOverStory } from '../src/sim/family.js';
import { FAMILY, LEVELS } from '../src/config.js';

describe('family rewards', () => {
  it('finds the biggest need that an amount pays for', () => {
    expect(needFor(100)).toBeNull();
    expect(needFor(FAMILY.needs[1].cost)).toBe(FAMILY.needs[1]);
    expect(needFor(1e9)).toBe(FAMILY.needs[FAMILY.needs.length - 1]);
  });

  it('says what a fare pays for at home', () => {
    expect(deliveryLine(2600)).toContain('2,600 RWF');
    expect(deliveryLine(2600)).toContain(needFor(2600).text);
  });

  it('a good day: the money goes home, and the savings progress shows', () => {
    const s = dayEndStory({ profit: 8000, cash: 10000, day: 2, outOfCash: null, level: LEVELS[0], savingsTarget: 20000 });
    expect(s.title).toBe('FOR YOUR FAMILY');
    expect(s.lines.join(' ')).toContain('8,000 RWF');
    expect(s.lines.join(' ')).toContain('50%');
  });

  it('a bad day and out of cash have their own words', () => {
    expect(dayEndStory({ profit: -500, cash: 3000, day: 1, level: LEVELS[0], savingsTarget: 20000 }).lines[0]).toContain('loss');
    expect(dayEndStory({ profit: -9000, cash: -100, day: 1, outOfCash: true }).lines[0]).toContain('No money');
  });

  it('every level with a milestone has a story', () => {
    for (const l of LEVELS) expect(l.story, l.name).toBeTruthy();
  });

  it('game over: says why, and that you ride a bicycle taxi again', () => {
    const empty = gameOverStory({ gameOver: 'stranded', bikeType: 'petrol', cash: -200 });
    expect(empty.reason).toContain('no cash for fuel');
    expect(gameOverStory({ gameOver: 'stranded', bikeType: 'electric', cash: 0 }).reason).toContain('swap');
    const debt = gameOverStory({ gameOver: 'cash', bikeType: 'petrol', cash: -2300 });
    expect(debt.reason).toContain('−2,300 RWF');
    expect(debt.lines.join(' ')).toContain('bicycle taxi');
    // Your own electric moto: no owner takes it back; you sell it to pay what you owe.
    const own = gameOverStory({ gameOver: 'cash', bikeType: 'electric', cash: -900 });
    expect(own.reason).toContain('bills');
    expect(own.lines.join(' ')).toContain('sell your moto');
    expect(own.lines.join(' ')).not.toContain('owner');
  });

  it('jail: you hit a police officer', () => {
    const jail = gameOverStory({ gameOver: 'jail', bikeType: 'petrol', cash: 300, hitKmh: 34 });
    expect(jail.reason).toContain('police officer at 34 km/h');
    expect(jail.lines.join(' ')).toContain('jail');
    expect(jail.short).toContain('Jail');
  });
});
