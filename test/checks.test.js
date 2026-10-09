import { describe, it, expect } from 'vitest';
import { HELMET_CHECKS as HC } from '../src/config.js';
import { pickCheckpoints, stepHelmetCheck } from '../src/sim/checks.js';

const officers = [{ x: 0, y: 0, d: 'town' }, { x: 500, y: 0, d: 'town' }, { x: 900, y: 0, d: 'kacyiru' }];
const districtOf = (o) => o.d;
const run = (state, bikeAt, ctx, seconds) => {
  const out = [];
  for (let t = 0; t < seconds; t += 0.1) out.push(...stepHelmetCheck(state, { bike: bikeAt(t), ...ctx }, 0.1));
  return out.map((e) => e.reason ?? e.type);
};

describe('police helmet checks (hard mode)', () => {
  it('picks checkpoints only in open districts, the same for the same day', () => {
    const s = pickCheckpoints(officers, districtOf, ['town'], 4, 5);
    expect(s.checkpoints.every((o) => o.d === 'town')).toBe(true);
    expect(pickCheckpoints(officers.map((o) => o), districtOf, ['town'], 4, 1).checkpoints[0].x).toBe(pickCheckpoints(officers, districtOf, ['town'], 4, 1).checkpoints[0].x);
  });

  it('stop with a helmet for the passenger: you pass', () => {
    const s = { checkpoints: [officers[0]], done: new Set(), active: null };
    const ev = run(s, () => ({ x: 3, y: 0, speed: 0 }), { passenger: true, hasHelmet: true }, HC.checkSeconds + 2);
    expect(ev).toEqual(['called', 'checking', 'passed']);
  });

  it('no passenger helmet: a fine; ride on: a fine; no passenger: no check', () => {
    const s1 = { checkpoints: [officers[0]], done: new Set(), active: null };
    expect(run(s1, () => ({ x: 3, y: 0, speed: 0 }), { passenger: true, hasHelmet: false }, HC.checkSeconds + 2)).toContain('noHelmet');
    const s2 = { checkpoints: [officers[0]], done: new Set(), active: null };
    expect(run(s2, (t) => ({ x: 5 + t * 10, y: 0, speed: 10 }), { passenger: true, hasHelmet: true }, 6)).toEqual(['called', 'noStop']);
    const s3 = { checkpoints: [officers[0]], done: new Set(), active: null };
    expect(run(s3, () => ({ x: 3, y: 0, speed: 0 }), { passenger: false, hasHelmet: false }, 5)).toEqual([]);
  });
});
