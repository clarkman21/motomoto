import { describe, it, expect } from 'vitest';
import { createCalls, callEvent, stepCalls, hangUp, CALLS } from '../src/sim/calls.js';
import { TIPS, tipLines } from '../src/sim/lesson.js';
import { newCall, stepCall, lineSeconds } from '../src/sim/phone.js';
import { textWidth } from '../src/world/garage-sprites.js';
import { LESSON } from '../src/config.js';

// Rukundo's first-time calls (sim/calls.js) and the shared phone call (sim/phone.js).

const run = (calls, seconds, busy = false, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...stepCalls(calls, dt, busy));
  return events;
};

describe('a phone call', () => {
  it('rings, then shows each line long enough to read it, then ends', () => {
    const call = newCall({ id: 'x' }, ['One.', 'Two, a longer line.']);
    const seen = [];
    for (let t = 0; t < 20; t += 0.05) {
      const e = stepCall(call, 0.05);
      if (e) seen.push(e);
      if (e === 'end') break;
    }
    expect(seen).toEqual(['line', 'line', 'end']);
    expect(lineSeconds('Two, a longer line.')).toBeGreaterThan(lineSeconds('One.'));
  });
});

describe('the first-time calls', () => {
  it('the first muzungu: the phone rings, Rukundo talks, then hangs up; one time only', () => {
    const c = createCalls();
    expect(callEvent(c, 'muzungu')).toBe(true);
    const ev = run(c, 60);
    expect(ev.map((e) => e.type).filter((t) => t !== 'line')).toEqual(['ring', 'hangUp']);
    expect(ev.filter((e) => e.type === 'line')).toHaveLength(CALLS.muzungu.length);
    expect(c.call).toBeNull();
    expect(callEvent(c, 'muzungu')).toBe(false); // heard: not again
    expect(createCalls([...c.seen]).seen.has('muzungu')).toBe(true); // a saved game remembers it
  });

  it('waits while another call (the lesson) is on the phone', () => {
    const c = createCalls();
    callEvent(c, 'vip');
    expect(run(c, 5, true)).toEqual([]);
    expect(run(c, 0.2).map((e) => e.type)).toEqual(['ring']);
  });

  it('unknown ids do nothing, and L hangs up a call at once', () => {
    const c = createCalls();
    expect(callEvent(c, undefined)).toBe(false);
    expect(callEvent(c, 'nothing')).toBe(false);
    callEvent(c, 'rush');
    run(c, 2);
    expect(c.call).not.toBeNull();
    expect(hangUp(c)).toBe(true);
    expect(c.call).toBeNull();
    expect(c.seen.has('rush')).toBe(true);
  });

  it('has a call for each side mission kind, the muzungu and the special days', () => {
    for (const id of ['muzungu', 'vip', 'rush', 'ikivuguto', 'hotel', 'batteries', 'umuganda', 'carFree']) expect(CALLS[id]?.length).toBeGreaterThan(1);
  });
});

describe('the lines on the phone', () => {
  const all = [...TIPS.flatMap((t) => [...tipLines(t, false), ...tipLines(t, true)]), ...Object.values(CALLS).flat()];

  it('use the Kigali moto lingo: kabisa, chef, Maria, afande, sha, twende', () => {
    const text = all.join(' ');
    for (const word of ['kabisa', 'chef', 'Maria', 'afande', 'sha', 'Twende', 'Nta kibazo']) expect(text).toContain(word);
  });

  it('fit in the call window (3 lines of 150 pixels) and use only letters of the small font', () => {
    const wrap = (text) => {
      const lines = [];
      let line = '';
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && textWidth(next) > 150) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      return [...lines, line];
    };
    for (const line of all) {
      expect(wrap(line).length, line).toBeLessThanOrEqual(3);
      expect(line, line).toMatch(/^[A-Za-z0-9 .,:;!?'"\-()]+$/);
      expect(lineSeconds(line)).toBeGreaterThan(LESSON.lineSeconds);
    }
  });
});
