import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { createJobBoard, mulberry32, makeOffer, acceptOffer, updateJob } from '../src/sim/jobs.js';
import { maybeVisitor, stepVisitor, greeting, dropOffLines, sightNear, quietNear, VISITOR_LINES } from '../src/sim/muzungu.js';
import { updateStreak, districtsForLevel } from '../src/sim/levels.js';
import { MUZUNGU, JOBS, WORLD, STREAK } from '../src/config.js';
import { drawBike, BIKE_LOADS } from '../src/world/sprites.js';

const world = new World(buildKigaliMap());
const T = WORLD.tileMetres;
const always = () => 0; // an rng that always says yes (and picks the first item)

const boardAt = (level) => createJobBoard(world, 1, { districts: districtsForLevel(level), fareMultiplier: 1, maxOffers: 0 });

describe('muzungu offers', () => {
  it('start at a hotel or a landmark and go to a place a visitor wants to see', () => {
    const board = boardAt(6);
    const rng = mulberry32(3);
    for (let i = 0; i < 40; i++) {
      const o = maybeVisitor(makeOffer(world, rng, i, board.opts), board, world, 6, always);
      expect(o.visitor).toBe(true);
      expect(o.type).toBe('passenger');
      expect(MUZUNGU.startIds).toContain(o.from.id);
      expect(MUZUNGU.endIds).toContain(o.to.id);
      expect(o.from).not.toBe(o.to);
    }
  });

  it('pay 4 times a normal fare for the same trip', () => {
    const board = boardAt(6);
    const o = maybeVisitor(makeOffer(world, mulberry32(5), 1, board.opts), board, world, 6, always);
    const p = JOBS.passenger;
    const normal = (p.base + p.perGameKm * o.gameKm) * (o.from.district === 'town' ? 1.1 : 1);
    expect(o.pay / normal).toBeGreaterThan(MUZUNGU.fareFactor * 0.9);
  });

  it('come about once in 15 offers, at most 2 on the board, not before the town opens', () => {
    const board = boardAt(6);
    const rng = mulberry32(9);
    let n = 0;
    for (let i = 0; i < 3000; i++) if (maybeVisitor(makeOffer(world, rng, i, board.opts), board, world, 6, rng).visitor) n++;
    expect(n / 3000).toBeGreaterThan(0.04);
    expect(n / 3000).toBeLessThan(0.1);
    board.offers = [{ visitor: true }, { visitor: true }];
    expect(maybeVisitor(makeOffer(world, rng, 1, board.opts), board, world, 6, always).visitor).toBeUndefined();
    board.offers = [];
    expect(maybeVisitor(makeOffer(world, rng, 1, board.opts), board, world, 1, always).visitor).toBeUndefined();
  });

  it('a side mission stays a side mission', () => {
    const board = boardAt(6);
    const o = { ...makeOffer(world, mulberry32(2), 1, board.opts), mission: { kind: 'vip' } };
    expect(maybeVisitor(o, board, world, 6, always)).toBe(o);
  });
});

describe('the muzungu on the bike', () => {
  const ride = () => ({ visitor: true, stage: 'toDropoff', pay: 20000 });
  const calm = { kmh: 30, bump: false, sight: null, quiet: false, police: false, market: false, uphill: false };

  it('shows as a visitor on the bike after the pickup', () => {
    const board = boardAt(6);
    board.offers = [maybeVisitor(makeOffer(world, mulberry32(4), 1, board.opts), board, world, 6, always)];
    const job = acceptOffer(board, 0);
    const bike = { x: job.from.x * T, y: job.from.y * T, vx: 0, vy: 0, heading: 0, loadKg: 0 };
    updateJob(board, bike, [], 1 / 120);
    expect(bike.loadType).toBe('visitor');
    expect(BIKE_LOADS).toContain('visitor');
    expect(drawBike('electric', 3, 'visitor').width).toBeGreaterThan(0);
  });

  it('greets you by the time of day and pays with "keep the change"', () => {
    expect(greeting(8)[0]).toBe(VISITOR_LINES.morning);
    expect(greeting(17)[0]).toBe(VISITOR_LINES.afternoon);
    const [pay, , reply] = dropOffLines(mulberry32(1));
    expect(pay).toMatch(/KEEP THE CHANGE/);
    expect(reply).toBe('MURAKOZE, MUZUNGU!');
  });

  it('a slow ride past a sight: a photo and a bigger tip, once for each sight', () => {
    const job = ride();
    const kcc = sightNear(110 * T, 90.5 * T);
    expect(kcc.id).toBe('kcc');
    const out = stepVisitor(job, { ...calm, kmh: 15, sight: kcc }, 0.1, always);
    const photo = out.find((e) => e.type === 'photo');
    expect(photo.tip).toBe(Math.round((20000 * MUZUNGU.photoTipFactor) / 10) * 10);
    expect(job.visitorState.photoTip).toBe(photo.tip);
    for (let i = 0; i < 100; i++) stepVisitor(job, { ...calm, kmh: 15, sight: kcc }, 0.1, always);
    expect(job.visitorState.photos).toBe(1);
  });

  it('no free photo of a sight next to the pickup place', () => {
    const job = { ...ride(), from: { x: 34, y: 89 } }; // Kigali City Tower
    const tower = sightNear(34 * T, 87 * T);
    expect(stepVisitor(job, { ...calm, kmh: 0, sight: tower }, 0.1, always).some((e) => e.type === 'photo')).toBe(false);
  });

  it('too fast past a sight: only "OH WOW", no photo', () => {
    const job = ride();
    const kcc = sightNear(110 * T, 90.5 * T);
    const out = stepVisitor(job, { ...calm, kmh: 45, sight: kcc }, 0.1, always);
    expect(out).toEqual([{ type: 'say', who: 'visitor', text: kcc.line }]);
    expect(job.visitorState.photos).toBe(0);
  });

  it('bumps, speed and the police make the visitor talk; not too often', () => {
    const job = ride();
    expect(stepVisitor(job, { ...calm, bump: true }, 0.1, always)[0].text).toBe(VISITOR_LINES.bump);
    expect(stepVisitor(job, { ...calm, kmh: 60 }, 0.1, always)).toEqual([]); // the gap between lines
    for (let i = 0; i < 40; i++) stepVisitor(job, calm, 0.1, () => 0.99);
    expect(stepVisitor(job, { ...calm, kmh: 60 }, 0.1, always)[0].text).toBe(VISITOR_LINES.fast);
    for (let i = 0; i < 80; i++) stepVisitor(job, calm, 0.1, () => 0.99); // (a chatter line comes in this time)
    expect(stepVisitor(job, { ...calm, police: true }, 0.1, always)[0].text).toBe(VISITOR_LINES.police);
  });

  it('says nothing near a quiet place', () => {
    const parliament = world.places.find((p) => p.id === 'parliament');
    expect(quietNear(world.places, parliament.x * T, parliament.y * T)).toBe(true);
    expect(quietNear(world.places, 29 * T, 15 * T)).toBe(false);
    const job = ride();
    expect(stepVisitor(job, { ...calm, bump: true, quiet: true }, 0.1, always)).toEqual([]);
  });

  it('a clean ride counts as 3 rides for the streak', () => {
    const wallet = { streak: 0 };
    for (let i = 0; i < MUZUNGU.streakRides; i++) updateStreak(wallet, true);
    expect(wallet.streak).toBeCloseTo(STREAK.step * 3);
  });
});
