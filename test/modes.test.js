import { describe, it, expect } from 'vitest';
import { MODES } from '../src/config.js';
import { modeOf, setHazardShare } from '../src/sim/modes.js';
import { createWallet } from '../src/sim/economy.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';

describe('difficulty modes', () => {
  it('has easy, medium and hard; an old save plays as medium', () => {
    expect(Object.keys(MODES)).toEqual(['easy', 'medium', 'hard']);
    expect(modeOf(createWallet()).id).toBe('medium');
    expect(modeOf({ mode: 'hard' }).name).toBe('Kigali 2020');
    expect(modeOf({ mode: 'nonsense' }).id).toBe('medium');
  });

  it('easy is easier than medium, and hard is harder', () => {
    const { easy, medium, hard } = MODES;
    expect(easy.wear).toBeLessThan(medium.wear);
    expect(hard.wear).toBeGreaterThan(medium.wear);
    expect(easy.traffic).toBeLessThan(medium.traffic);
    expect(hard.traffic).toBeGreaterThan(medium.traffic);
    expect(easy.cameras || easy.police).toBe(false);
    expect(hard.riderEnergy && hard.helmetChecks).toBe(true);
    expect(easy.riderEnergy).toBe(false);
    // Medium (Alp): the rider must eat, but more slowly than on hard.
    expect(medium.riderEnergy).toBeGreaterThan(0);
    expect(medium.riderEnergy).toBeLessThan(hard.riderEnergy);
  });

  it('all the fines are only on hard (Alp)', () => {
    const { easy, medium, hard } = MODES;
    for (const m of [easy, medium]) {
      expect(m.fines).toBe(false);
      expect(m.cameras || m.police || m.helmetChecks).toBe(false);
      expect(m.lights).not.toBe('cameras');
    }
    expect(hard.fines && hard.cameras && hard.police && hard.helmetChecks).toBe(true);
  });

  it('no gear option in any mode (always manual); the police chase on the pavement on medium and hard', () => {
    for (const m of Object.values(MODES)) expect(m.gears).toBeUndefined();
    expect(MODES.easy.pavementChase).toBe(false);
    expect(MODES.medium.pavementChase && !MODES.medium.fines && !MODES.medium.police).toBe(true);
    expect(MODES.hard.pavementChase && MODES.hard.police).toBe(true);
  });

  it('easy has about half the potholes and rocks, and never removes speed bumps', () => {
    const world = new World(buildKigaliMap());
    const count = (h) => world.tiles.filter((t) => t.hazard === h).length;
    const potholes = count('pothole'), bumps = count('speedBump');
    expect(setHazardShare(world, 0.5)).toBe(true);
    expect(count('pothole')).toBeGreaterThan(potholes * 0.35);
    expect(count('pothole')).toBeLessThan(potholes * 0.65);
    expect(count('speedBump')).toBe(bumps);
    expect(setHazardShare(world, 0.5)).toBe(false); // no change: no new drawing
    setHazardShare(world, 1);
    expect(count('pothole')).toBe(potholes);
  });
});
