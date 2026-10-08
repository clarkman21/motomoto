import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { createJobBoard, mulberry32 } from '../src/sim/jobs.js';
import { dayStats, pickQuests, recordDelivery, recordFine, checkQuests, questProgress, maybeMission, stepMission, missionResult, findSecret } from '../src/sim/missions.js';
import { districtsForLevel } from '../src/sim/levels.js';
import { MISSIONS } from '../src/config.js';

const world = new World(buildKigaliMap());
const job = (over = {}) => ({ type: 'passenger', from: world.places[0], to: world.places[1], pay: 3000, comfort: 100, damage: 0, clean: true, ...over });

describe('daily app quests', () => {
  it('come with the smartphone (from level 3), two each day, and pay more at higher levels', () => {
    expect(pickQuests(2, mulberry32(1))).toEqual([]);
    const q3 = pickQuests(3, mulberry32(1));
    expect(q3).toHaveLength(MISSIONS.questsPerDay);
    expect(new Set(q3.map((q) => q.kind)).size).toBe(q3.length);
    expect(pickQuests(8, mulberry32(1))[0].reward).toBeGreaterThan(q3[0].reward);
  });

  it('a quest is done when its goal is reached, and pays once', () => {
    const q = [{ kind: 'jobs', goal: 2, reward: 3000, done: false, text: '2 JOBS TODAY' }];
    const s = dayStats();
    recordDelivery(s, job(), 2000, 9, true);
    expect(checkQuests(q, s)).toEqual([]);
    recordDelivery(s, job(), 2000, 13, true);
    expect(checkQuests(q, s)).toHaveLength(1);
    expect(checkQuests(q, s)).toHaveLength(0);
  });

  it('morning jobs, cargo, clean rides and no fines', () => {
    const s = dayStats();
    recordDelivery(s, job(), 2000, 9, true);
    recordDelivery(s, job({ type: 'cargo' }), 2000, 11.5, true);
    recordDelivery(s, job(), 2000, 14, false);
    expect(s).toMatchObject({ jobs: 3, jobsBeforeNoon: 2, cargo: 1, bestCleanRun: 2, cleanRun: 0, fares: 4000 });
    expect(questProgress({ kind: 'noFines', goal: 4 }, s)).toBe(3);
    recordFine(s);
    expect(questProgress({ kind: 'noFines', goal: 4 }, s)).toBe(0);
  });
});

describe('side missions', () => {
  const board = createJobBoard(world, 3, { districts: districtsForLevel(5), maxOffers: 0 });
  const offers = (level) => {
    const rng = mulberry32(5);
    const out = [];
    for (let i = 0; i < 300; i++) {
      const o = maybeMission({ type: 'passenger', from: world.places[0], to: world.places[3], distanceMetres: 800, gameKm: 1, pay: 3000, kg: 70, life: 30 }, board, world, level, rng);
      if (o.mission) out.push(o);
    }
    return out;
  };

  it('none before level 3; then a few offers become missions of every kind', () => {
    expect(offers(2)).toHaveLength(0);
    const m = offers(5);
    expect(m.length).toBeGreaterThan(20);
    expect(new Set(m.map((o) => o.mission.kind))).toEqual(new Set(['vip', 'rush', 'ikivuguto', 'hotel']));
    for (const o of m) expect(o.mission.bonus).toBeGreaterThan(0);
    const milk = m.find((o) => o.mission.kind === 'ikivuguto');
    expect(milk.from.tags).toContain('milk');
    expect(milk).toMatchObject({ type: 'cargo', goods: 'ikivuguto', fragile: true });
    expect(m.find((o) => o.mission.kind === 'hotel').from.tags).toContain('hotel');
  });

  it('a VIP pays the bonus only after a clean, comfortable ride', () => {
    const m = { kind: 'vip', title: 'VIP PASSENGER', bonus: 2000 };
    expect(missionResult(job({ mission: m })).bonus).toBe(2000);
    expect(missionResult(job({ mission: m, clean: false })).bonus).toBe(0);
    expect(missionResult(job({ mission: m, comfort: 60 })).ok).toBe(false);
  });

  it('a rush delivery has a clock; late, it pays half the fare and no bonus', () => {
    const j = job({ mission: { kind: 'rush', title: 'RUSH DELIVERY', bonus: 1500, limit: 10 }, stage: 'toDropoff' });
    stepMission(j, 4);
    expect(missionResult(j)).toMatchObject({ ok: true, bonus: 1500 });
    stepMission(j, 7);
    expect(missionResult(j)).toMatchObject({ ok: false, bonus: 0, farePenalty: 1500 });
  });

  it('spilled ikivuguto: no bonus', () => {
    const m = { kind: 'ikivuguto', title: 'IKIVUGUTO', bonus: 1000 };
    expect(missionResult(job({ type: 'cargo', mission: m, damage: 0.05 })).ok).toBe(true);
    expect(missionResult(job({ type: 'cargo', mission: m, damage: 0.3 })).ok).toBe(false);
  });
});

describe('secret places', () => {
  it('are on open ground, and some need the night or the fountain spray', () => {
    expect(world.secrets.length).toBeGreaterThanOrEqual(5);
    for (const s of world.secrets) expect(world.isSolidAt(s.x * 4, s.y * 4, false), s.id).toBe(false);
    const love = world.secrets.find((s) => s.when === 'night');
    const at = { x: love.x * 4, y: love.y * 4 };
    expect(findSecret(world.secrets, [], at, { night: false })).toBeNull();
    expect(findSecret(world.secrets, [], at, { night: true }).id).toBe(love.id);
    expect(findSecret(world.secrets, [love.id], at, { night: true })).toBeNull(); // once in a game
  });
});
