import { describe, it, expect } from 'vitest';
import { HQ, WORLD } from '../src/config.js';
import { hqMissionDue, createHq, hqAction, stepWalk, stepTrack, stepExit, skipTrack, inYard, alphaSpots, ribbonAlpha, trackLayout, deskSpot, hqGoal, tradeSpots } from '../src/sim/hq.js';
import { createWallet } from '../src/sim/economy.js';
import { startAtLevel } from '../src/sim/levels.js';

const T = WORLD.tileMetres;
const bikeAt = (x, y, v = 0) => ({ x, y, vx: v, vy: 0, heading: 0 });
const inGate = () => ({ x: ((HQ.gates.in[0] + HQ.gates.in[1]) / 2) * T, y: (HQ.yard.y1 + 0.5) * T });

describe('Ampersand HQ mission', () => {
  it('is due after the level 4 milestone, until you ride the Alpha; test mode skips it', () => {
    const w = createWallet();
    expect(hqMissionDue(w)).toBe(false);
    w.perks.alphaReady = true;
    expect(hqMissionDue(w)).toBe(true);
    w.perks.electric = true;
    expect(hqMissionDue(w)).toBe(false);
    const t = startAtLevel(createWallet(), 5);
    expect(t.perks.electric).toBe(true);
    expect(hqMissionDue(t)).toBe(false);
  });

  it('has rows of new Alphas with one ribbon, a trade-in row, a track with 4 gates, all in the yard', () => {
    const spots = alphaSpots();
    expect(spots.length).toBeGreaterThanOrEqual(20);
    expect(spots.filter((s) => s.ribbon)).toHaveLength(1);
    for (const s of [...spots, ...tradeSpots(), deskSpot()]) expect(inYard(s.x, s.y)).toBe(true);
    const { cones, gates } = trackLayout();
    expect(gates).toHaveLength(4);
    expect(cones.length).toBeGreaterThan(20);
    for (const c of cones) expect(inYard(c.x, c.y)).toBe(true);
    // No cone stands on a gate.
    for (const g of gates) for (const c of cones) expect(Math.hypot(c.x - g.x, c.y - g.y)).toBeGreaterThan(1.5);
  });

  it('runs: get off, hand in, walk to the Alpha, the track, ride out', () => {
    const hq = createHq();
    expect(hqGoal(hq).text).toBe('ride');
    // Outside the yard or too fast: no.
    expect(hqAction(hq, bikeAt(0, 0)).reason).toBe('yard');
    const g = inGate();
    expect(hqAction(hq, bikeAt(g.x, g.y - 4, 5)).reason).toBe('stop');
    expect(hqAction(hq, bikeAt(g.x, g.y - 4), true).reason).toBe('job');
    expect(hqAction(hq, bikeAt(g.x, g.y - 4)).type).toBe('off');
    expect(hq.stage).toBe('desk');
    // Walk to the desk with the arrow keys (screen directions), then F.
    expect(hqAction(hq, bikeAt(g.x, g.y)).reason).toBe('desk');
    const walkTo = (p) => {
      for (let i = 0; i < 4000; i++) {
        const w = hq.walker, dx = p.x - w.x, dy = p.y - w.y;
        if (Math.hypot(dx, dy) < 0.5) return true;
        // World to screen direction: screen x = wx - wy, screen y = (wx + wy) / 2.
        const sx = dx - dy, sy = (dx + dy) / 2, l = Math.hypot(sx, sy);
        stepWalk(hq, { x: sx / l, y: sy / l }, 0.05);
      }
      return false;
    };
    expect(walkTo(deskSpot())).toBe(true);
    const t = hqAction(hq, bikeAt(0, 0));
    expect(t).toEqual({ type: 'tradeIn', cash: HQ.tradeIn });
    expect(walkTo(ribbonAlpha())).toBe(true);
    const m = hqAction(hq, bikeAt(0, 0));
    expect(m.type).toBe('mount');
    expect(hq.stage).toBe('track');
    // Ride through the gates in order; a cone adds seconds.
    const bike = bikeAt(m.x, m.y);
    const c = hq.cones[0];
    Object.assign(bike, { x: c.x, y: c.y });
    expect(stepTrack(hq, bike, 1).some((e) => e.type === 'cone')).toBe(true);
    expect(hq.penalty).toBe(HQ.conePenalty);
    let done = null;
    for (const gate of hq.gates) {
      Object.assign(bike, { x: gate.x, y: gate.y });
      done = stepTrack(hq, bike, 5).find((e) => e.type === 'trackDone') ?? done;
    }
    expect(done.skipped).toBe(false);
    expect(done.seconds).toBeCloseTo(21 + HQ.conePenalty);
    expect(done.bonus).toBe(HQ.bonus);
    expect(hq.stage).toBe('exit');
    expect(stepExit(hq, bike)).toBeNull(); // still in the yard
    const out = stepExit(hq, bikeAt(((HQ.gates.out[0] + HQ.gates.out[1]) / 2) * T, (HQ.yard.y1 + 1.5) * T));
    expect(out).toEqual({ type: 'out', gate: true });
    expect(hq.stage).toBe('done');
  });

  it('the walker stays in the yard and out of the hall; the track can be skipped (no bonus)', () => {
    const hq = createHq();
    const g = inGate();
    hqAction(hq, bikeAt(g.x, g.y - 4));
    for (let i = 0; i < 400; i++) stepWalk(hq, { x: 0, y: 1 }, 0.1); // down the screen: to the south fence
    expect(inYard(hq.walker.x, hq.walker.y)).toBe(true);
    hq.walker.x = 152 * T; // under the hall
    for (let i = 0; i < 800; i++) stepWalk(hq, { x: 1, y: -0.5 }, 0.1); // up the screen along the world y axis: to the hall
    expect(hq.walker.y).toBeGreaterThan((HQ.building.y1 + 1) * T);
    hq.stage = 'track';
    const r = skipTrack(hq);
    expect(r.skipped).toBe(true);
    expect(r.bonus).toBe(0);
    expect(hq.stage).toBe('exit');
  });
});
