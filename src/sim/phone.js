import { LESSON } from '../config.js';

// A phone call in the HUD: the phone rings, then the caller talks, one line at a time. The Motari lesson
// (sim/lesson.js) and the first-time calls (sim/calls.js) use it. No Phaser here.
// A call is { tip: { id }, caller, lines, line, lineTime, ringing }.

/** A new call. ringing: seconds that the phone rings before the first line (0: no ring). */
export function newCall(tip, lines, ringing = LESSON.ringSeconds, caller = 'RUKUNDO') {
  return { tip, caller, lines, line: 0, lineTime: 0, ringing };
}

/**
 * Advance a call by dt. Returns 'line' when a new line starts, 'end' after the last line, or null.
 */
export function stepCall(call, dt) {
  if (call.ringing > 0) {
    call.ringing -= dt;
    return call.ringing <= 0 ? 'line' : null;
  }
  call.lineTime += dt;
  if (call.lineTime < lineSeconds(call.lines[call.line])) return null;
  call.line++;
  call.lineTime = 0;
  return call.line < call.lines.length ? 'line' : 'end';
}

/** How long a line shows: a base time plus time to read each letter. */
export function lineSeconds(text) {
  return LESSON.lineSeconds + text.length * LESSON.secondsPerChar;
}

/** The letters of the current line that show now (the line types out). */
export function lineShown(call) {
  if (!call || call.ringing > 0) return '';
  const text = call.lines[call.line] ?? '';
  return text.slice(0, Math.ceil(call.lineTime * LESSON.charsPerSecond));
}
