import { HELMET_CHECKS as HC } from '../config.js';
import { mulberry32 } from './jobs.js';

// Police helmet checks (hard mode). No Phaser here.
// state = { checkpoints: [officer], done: Set of officers, active: null | { officer, phase, timeLeft } }.

/** Choose today's checkpoints: officers in the open districts, seeded by the day. */
export function pickCheckpoints(officers, districtOf, openDistricts, day, n = HC.perDay) {
  const pool = officers.filter((o) => openDistricts.includes(districtOf(o.home ?? o)));
  const rng = mulberry32(day * 6151 + 3);
  rng();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return { checkpoints: out, done: new Set(), active: null };
}

/**
 * One step. ctx: { bike: { x, y, speed (m/s) }, passenger (a passenger on the bike), hasHelmet (a spare
 * passenger helmet) }. Returns events: 'called' (the officer waves you in), 'checking', 'passed',
 * and 'fine' with reason 'noStop' or 'noHelmet'.
 */
export function stepHelmetCheck(state, ctx, dt) {
  const events = [];
  const { bike } = ctx;
  const dist = (o) => Math.hypot(o.x - bike.x, o.y - bike.y);
  const a = state.active;
  if (!a) {
    if (!ctx.passenger) return events; // the rider has a helmet: only a passenger is checked
    const o = state.checkpoints.find((c) => !state.done.has(c) && dist(c) < HC.rangeMetres);
    if (o) {
      state.active = { officer: o, phase: 'stop', timeLeft: HC.stopSeconds };
      events.push({ type: 'called', officer: o });
    }
    return events;
  }
  const o = a.officer;
  a.timeLeft -= dt;
  if (a.phase === 'stop') {
    if (dist(o) < HC.stopMetres && bike.speed * 3.6 < 5) {
      a.phase = 'check';
      a.timeLeft = HC.checkSeconds;
      events.push({ type: 'checking', officer: o });
    } else if (a.timeLeft <= 0 || dist(o) > HC.rangeMetres * 2.5) {
      state.done.add(o);
      state.active = null;
      events.push({ type: 'fine', reason: 'noStop', officer: o });
    }
  } else if (a.timeLeft <= 0) {
    state.done.add(o);
    state.active = null;
    events.push(ctx.hasHelmet ? { type: 'passed', officer: o } : { type: 'fine', reason: 'noHelmet', officer: o });
  } else if (dist(o) > HC.stopMetres * 2) {
    // You rode away during the check.
    state.done.add(o);
    state.active = null;
    events.push({ type: 'fine', reason: 'noStop', officer: o });
  }
  return events;
}
