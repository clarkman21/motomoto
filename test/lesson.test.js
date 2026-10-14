import { describe, it, expect } from 'vitest';
import { createLesson, stepLesson, lessonEvent, skipLesson, stepClosing, tipLines, lineShown, TIPS } from '../src/sim/lesson.js';
import { LESSON } from '../src/config.js';

// The Motari lesson (level 1): Rukundo Thacien phones you with tips.

const quiet = { t: 0, kmh: 0, jobStage: undefined, passenger: false, murram: false, bumpAhead: false, officerNear: false, overLimitSeconds: 0, petrol: true, energy: 1, service: 0, night: 0 };
const run = (lesson, ctx, seconds, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...stepLesson(lesson, { ...ctx, t: (ctx.t ?? 0) + t }, dt));
  return events;
};

describe('the Motari lesson', () => {
  it('he calls first to say hello: the phone rings, then the lines type out one at a time', () => {
    const l = createLesson();
    expect(run(l, quiet, 1)).toEqual([]); // not in the first seconds
    const ev = run(l, { ...quiet, t: 3 }, 0.2);
    expect(ev.map((e) => e.type)).toEqual(['ring']);
    expect(l.call.tip.id).toBe('hello');
    expect(lineShown(l.call)).toBe(''); // still ringing
    run(l, { ...quiet, t: 4 }, LESSON.ringSeconds + 0.3);
    expect(lineShown(l.call).length).toBeGreaterThan(5);
    expect(l.call.lines[0]).toMatch(/Rukundo/);
    // After all the lines: he hangs up.
    const rest = run(l, { ...quiet, t: 10 }, 30);
    expect(rest.some((e) => e.type === 'hangUp')).toBe(true);
    expect(l.call).toBeNull();
  });

  it('tips come when their moment comes, one call at a time, never before hello', () => {
    const l = createLesson();
    run(l, { ...quiet, t: 0.5, murram: true, kmh: 20 }, 1);
    expect(l.queue).toEqual([]); // no hello yet: no murram tip
    run(l, { ...quiet, t: 3, murram: true, kmh: 20 }, 40);
    expect(l.seen.has('hello')).toBe(true);
    expect(l.seen.has('murram')).toBe(true);
    expect(l.seen.has('police')).toBe(false);
  });

  it('a crash or the first fare plays next, before the other tips that wait', () => {
    const l = createLesson(['hello']);
    l.queue.push('night');
    lessonEvent(l, 'crash');
    run(l, quiet, 0.2);
    expect(l.call.tip.id).toBe('crash');
    lessonEvent(l, 'crash'); // not two times
    expect(l.queue.filter((id) => id === 'crash')).toHaveLength(0);
  });

  it('the lines are English with Kinyarwanda words, and the keys or touch line fits the device', () => {
    const all = TIPS.flatMap((t) => [...tipLines(t, false), ...tipLines(t, true)]).join(' ');
    for (const word of ['Muraho', 'Komera', 'Murakoze', 'Buhoro buhoro']) expect(all).toContain(word);
    const hello = TIPS.find((t) => t.id === 'hello');
    expect(tipLines(hello, false).join(' ')).toMatch(/Press 1 to 4/);
    expect(tipLines(hello, true).join(' ')).toMatch(/Tap/);
  });

  it('skip: a short goodbye shows, then no more tips', () => {
    const l = createLesson();
    run(l, { ...quiet, t: 3 }, 0.5);
    skipLesson(l);
    expect(l.done).toBe(true);
    expect(l.skipped).toBe(true);
    expect(l.call.lines[0]).toMatch(/Komera/);
    for (let i = 0; i < 100; i++) stepClosing(l, 0.1);
    expect(l.call).toBeNull();
    expect(run(l, { ...quiet, t: 20, murram: true, kmh: 30 }, 10)).toEqual([]);
  });

  it('he says goodbye after enough tips, and the lesson ends', () => {
    const l = createLesson(['hello', 'pickup', 'passenger', 'paid', 'murram', 'bump', 'police', 'speed', 'fuel'].slice(0, LESSON.byeAfterTips));
    run(l, { ...quiet, t: 60 }, 60);
    expect(l.seen.has('bye')).toBe(true);
    expect(l.done).toBe(true);
    // A saved game with 'bye' seen: the lesson is over.
    expect(createLesson([...l.seen]).done).toBe(true);
  });
});
