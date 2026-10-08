import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { flagSpots, drawFlagCloth, fountainSpots, drawFountainSpray } from '../src/world/sprites.js';
import { CITY_ANIM, PALETTE } from '../src/config.js';

const world = new World(buildKigaliMap());
const pixels = (c) => { let n = 0; for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++; return n; };

describe('moving details of the city', () => {
  it('flags fly on government buildings, named ministries and the US Embassy (one flag for each building)', () => {
    const spots = flagSpots(world);
    expect(spots.filter((s) => s.kind === 'us')).toHaveLength(1);
    const groups = spots.map((s) => s.block.groupId);
    expect(new Set(groups).size).toBe(groups.length);
    const ministries = spots.filter((s) => s.block.flag).length;
    expect(ministries).toBe(3);
    expect(spots.length).toBeGreaterThan(ministries + 4);
  });

  it('the flag cloth waves: the frames differ, and the Rwandan flag has blue, yellow and green', () => {
    const frames = Array.from({ length: CITY_ANIM.flagFrames }, (_, f) => drawFlagCloth('rw', f, CITY_ANIM.flagFrames));
    expect(new Set(frames.map((c) => Array.from(c.data).join(','))).size).toBe(CITY_ANIM.flagFrames);
    const has = (c, rgb) => { for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3] && ((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]) === rgb) return true; return false; };
    for (const rgb of [PALETTE.rwBlue, PALETTE.rwYellow, PALETTE.rwGreen]) expect(has(frames[0], rgb)).toBe(true);
  });

  it('the MTN fountain sprays now and then, not all the time', () => {
    expect(fountainSpots(world)).toHaveLength(1);
    expect(pixels(drawFountainSpray(0))).toBeGreaterThan(80);
    expect(CITY_ANIM.sprayForSeconds).toBeLessThan(CITY_ANIM.sprayEverySeconds / 2);
  });
});
