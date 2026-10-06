import { describe, it, expect } from 'vitest';
import { readControls, keyboardHeading } from '../src/sim/controls.js';
import { toScreen, toWorld, screenDirToHeading, headingToScreenDir } from '../src/world/iso.js';

const raw = (keys = {}) => ({ keys: { up: false, down: false, left: false, right: false, throttle: false, brake: false, ...keys }, stick: { x: 0, y: 0, active: false } });

describe('keyboardHeading', () => {
  it('maps diagonals to the road axes', () => {
    expect(keyboardHeading(1, -1)).toBeCloseTo(-Math.PI / 2); // up + right = world -y
    expect(keyboardHeading(1, 1)).toBeCloseTo(0); // down + right = world +x
    expect(keyboardHeading(-1, 1)).toBeCloseTo(Math.PI / 2); // down + left = world +y
  });
});

describe('screen relative steering', () => {
  it('goes straight with full throttle when the key points ahead', () => {
    const bike = { heading: 0, vx: 5, vy: 0 };
    const c = readControls('screen', raw({ down: true, right: true }), bike);
    expect(c.throttle).toBe(1);
    expect(c.steer).toBeCloseTo(0);
  });

  it('brakes when the key points behind at speed', () => {
    const bike = { heading: 0, vx: 8, vy: 0 };
    const c = readControls('screen', raw({ up: true, left: true }), bike);
    expect(c.brake).toBe(1);
    expect(c.throttle).toBe(0);
  });
});

describe('bike relative steering', () => {
  it('uses left and right to turn, up and down for throttle and brake', () => {
    expect(readControls('bike', raw({ left: true, up: true }), {})).toEqual({ steer: -1, throttle: 1, brake: 0 });
    expect(readControls('bike', raw({ right: true, down: true }), {})).toEqual({ steer: 1, throttle: 0, brake: 1 });
  });
});

describe('iso projection', () => {
  it('toWorld inverts toScreen', () => {
    const s = toScreen(13, 7, 3);
    const w = toWorld(s.x, s.y, 3);
    expect(w.x).toBeCloseTo(13);
    expect(w.y).toBeCloseTo(7);
  });

  it('screen directions and headings convert both ways', () => {
    for (const h of [0, 0.5, 2, -1.2]) {
      const d = headingToScreenDir(h);
      expect(screenDirToHeading(d.x, d.y)).toBeCloseTo(h);
    }
  });
});
