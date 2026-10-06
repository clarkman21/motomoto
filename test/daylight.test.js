import { describe, it, expect } from 'vitest';
import { daylight, lightAt } from '../src/sim/daylight.js';

const rgb = (t) => [(t >> 16) & 255, (t >> 8) & 255, t & 255];

describe('day and night', () => {
  it('is full day at noon and full night at midnight', () => {
    expect(daylight(12)).toMatchObject({ light: 1, night: 0, tint: 0xffffff });
    expect(daylight(0).light).toBe(0);
    expect(daylight(0).night).toBe(1);
  });

  it('night is dark blue', () => {
    const [r, g, b] = rgb(daylight(22).tint);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeLessThan(110);
  });

  it('sunset is warm: more red than blue', () => {
    const [r, , b] = rgb(daylight(18.2).tint);
    expect(r).toBeGreaterThan(b + 30);
  });

  it('the lamps are on during the night shift (19:00 to 23:00) and off at midday', () => {
    expect(daylight(19.5).night).toBeGreaterThan(0.8);
    expect(daylight(13).night).toBe(0);
  });

  it('light changes smoothly through dawn', () => {
    expect(lightAt(6)).toBeGreaterThan(lightAt(5.5));
    expect(lightAt(7)).toBeGreaterThan(lightAt(6));
  });
});
