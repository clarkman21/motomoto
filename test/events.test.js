import { describe, it, expect } from 'vitest';
import { LEVELS, EVENTS, SURFACES } from '../src/config.js';
import { pickDayEvent, eventStage, eventLabel, eventLine, eventBark, eventSummary, rainTint, parkTraffic, wakeTraffic } from '../src/sim/events.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';

const level = (n) => LEVELS.find((l) => l.n === n);

describe('day events', () => {
  it('has no events before level 6, and only Umuganda at level 6', () => {
    for (const n of [1, 2, 3, 4, 5]) for (let d = 1; d < 60; d++) expect(pickDayEvent(level(n), d)).toBe(null);
    const kinds = new Set(Array.from({ length: 200 }, (_, d) => pickDayEvent(level(6), d + 1)));
    expect([...kinds].sort()).toEqual([null, 'umuganda'].sort());
  });

  it('gives each event about as often as the level says, and the same event for the same day', () => {
    const L = level(7), n = 2000;
    const days = Array.from({ length: n }, (_, d) => pickDayEvent(L, d + 1));
    const share = (k) => days.filter((e) => e === k).length / n;
    expect(share('umuganda')).toBeCloseTo(L.events.umuganda, 1);
    expect(share('rain')).toBeCloseTo(L.events.rain, 1);
    expect(pickDayEvent(L, 12)).toBe(pickDayEvent(L, 12));
  });

  it('Umuganda: no customers in the morning, then a rush with higher fares and more offers', () => {
    const u = EVENTS.umuganda;
    expect(eventStage('umuganda', 8)).toMatchObject({ stage: 'morning', customers: false, trafficFull: false });
    expect(eventStage('umuganda', u.endHour + 0.5)).toMatchObject({ stage: 'rush', customers: true, trafficFull: true, fare: u.rushFare });
    expect(eventStage('umuganda', u.endHour + 0.5).extraOffers).toBeGreaterThan(0);
    expect(eventStage('umuganda', u.rushEndHour + 1)).toMatchObject({ stage: null, fare: 1 });
    expect(eventLabel('umuganda', 8)).toBe('UMUGANDA');
    expect(eventLabel('umuganda', 12)).toBe('UMUGANDA RUSH');
    expect(eventLabel(null, 12)).toBe('');
    expect(eventLine('umuganda', 8).tone).toBe('warn');
    expect(eventLine('umuganda', 12).text).toContain('+30%');
    expect(eventLine(null, 8)).toBe(null);
    expect(eventBark('umuganda', undefined, 'morning')).toContain('Umuganda');
    expect(eventBark('umuganda', 'morning', 'rush')).toContain('over');
    expect(eventBark('umuganda', 'rush', null)).toContain('rush is over');
    expect(eventBark(null, undefined, null)).toBe(null);
    expect(eventSummary('umuganda')).toContain('Umuganda');
    expect(eventSummary(null)).toBe(null);
  });

  it('rain: higher fares, more hails, grey light and wet murram', () => {
    const r = eventStage('rain', 9);
    expect(r.fare).toBeGreaterThan(1);
    expect(r.hailEvery).toBeLessThan(1);
    const grey = rainTint(0xffffff);
    expect(grey).not.toBe(0xffffff);
    expect(grey >> 16).toBeLessThan(256);
    expect(grey & 255).toBeGreaterThan((grey >> 16) & 255); // a little blue
    const world = new World(buildKigaliMap());
    let murram = null;
    for (let y = 0; y < world.height && !murram; y++) for (let x = 0; x < world.width; x++) if (world.tile(x, y)?.surface === 'murram') { murram = { x, y }; break; }
    expect(murram).toBeTruthy();
    const at = [(murram.x + 0.5) * 4, (murram.y + 0.5) * 4];
    expect(world.surfaceAt(...at)).toBe(SURFACES.murram);
    world.rain = true;
    expect(world.surfaceAt(...at)).toBe(SURFACES.murramWet);
  });

  it('parks most traffic for Umuganda, and wakes it only far from the rider', () => {
    const traffic = { vehicles: Array.from({ length: 100 }, (_, i) => ({ id: i, x: i * 2, y: 0 })) };
    parkTraffic(traffic, 0.15, mulberry32(3));
    expect(traffic.vehicles.length).toBeLessThan(30);
    expect(traffic.vehicles.length + traffic.dormant.length).toBe(100);
    const woke = wakeTraffic(traffic, 0, 0, 70);
    expect(woke).toBeGreaterThan(0);
    expect(traffic.dormant.every((v) => Math.hypot(v.x, v.y) < 70)).toBe(true);
  });
});
