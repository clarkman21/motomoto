import { describe, it, expect } from 'vitest';
import { MODES } from '../src/config.js';
import { modeOf, forcedAutoShift, setHazardShare } from '../src/sim/modes.js';
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
    expect(medium.riderEnergy).toBe(false);
  });

  it('easy forces automatic gears, hard forces manual, medium keeps your choice', () => {
    expect(forcedAutoShift(MODES.easy, false)).toBe(true);
    expect(forcedAutoShift(MODES.hard, true)).toBe(false);
    expect(forcedAutoShift(MODES.medium, true)).toBe(true);
    expect(forcedAutoShift(MODES.medium, false)).toBe(false);
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
