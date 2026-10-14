import { RADIO } from '../config.js';

// The songs of Radio Inziza, made in code (no recordings, no real songs). Each station has a style
// (from the design canvas "Radio Inziza"); each track is a new loop in that style: its own key, chords
// and melody, from a seed (the track title). No Web Audio here (audio/radio.js plays the songs), so the
// tests run in Node.
//
// A song: { bpm, steps (16 for each bar), events: [{ t: step, d: steps, v: voice, m: MIDI note, g: gain,
// slide: MIDI note to glide to }] }. Drums have no note (v: 'kick', 'snare', 'hat', 'clap', 'shaker').

export const STEPS_PER_BAR = 16;
const BARS = 8;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function rngFrom(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const hits = (pattern) => [...pattern].flatMap((c, i) => (c === 'x' ? [[i, 1]] : c === 'o' ? [[i, 0.55]] : []));

/** The MIDI note of a scale degree (0 = the root; 7 = the root an octave up) in a key. */
function degree(root, scale, n) {
  const o = Math.floor(n / scale.length);
  return root + 12 * o + scale[((n % scale.length) + scale.length) % scale.length];
}

/** The 3 notes of the chord on a scale degree (a triad), from the root note of the key. */
const triad = (root, scale, d) => [0, 2, 4].map((k) => degree(root, scale, d + k));

// Each style: (rng, root) → { bpm, events }. chords: the scale degree of each of the 8 bars.
const STYLES = {
  // Old Rwandan band music (in the style of the 1970s and 80s Kigali dance bands): a bright picked
  // guitar, a horn tune, a walking bass and a soft shaker.
  impala(rng, root) {
    const chords = pick(rng, [[0, 3, 4, 0, 0, 3, 4, 0], [0, 3, 0, 4, 0, 3, 4, 0], [0, 4, 3, 4, 0, 4, 3, 0]]);
    const ev = [];
    chords.forEach((c, bar) => {
      const b = bar * 16, ch = triad(root, MAJOR, c);
      [0, 1, 2, 1, 0, 1, 2, 1].forEach((k, i) => ev.push({ t: b + i * 2, d: 2, v: 'pluck', m: ch[k] + (i % 4 === 2 ? 12 : 0), g: i % 2 ? 0.7 : 1 }));
      for (const [s, g] of hits('x..x..x.x..x..x.')) ev.push({ t: b + s, d: 2, v: 'bass', m: degree(root - 12, MAJOR, c + [0, 2, 4, 2, 0, 4][Math.min(5, Math.floor(s / 3))]), g });
      for (const [s, g] of hits('x.o.x.o.x.o.x.o.')) ev.push({ t: b + s, d: 1, v: 'shaker', g: g * 0.8 });
      for (const s of [0, 8]) ev.push({ t: b + s, d: 1, v: 'kick', g: 0.8 });
      for (const s of [4, 12]) ev.push({ t: b + s, d: 1, v: 'snare', g: 0.45 });
    });
    melody(ev, rng, chords, root + 12, MAJOR, 'horn', 'x...x.x.....x.x.', 3);
    return { bpm: 118, events: ev };
  },
  // Congolese rumba and soukous: two guitars that answer each other (a fast, high sebene line), a round
  // bass and a snare on each beat.
  rumba(rng, root) {
    const chords = pick(rng, [[0, 3, 4, 3, 0, 3, 4, 0], [0, 4, 3, 4, 0, 4, 0, 4], [0, 0, 3, 4, 0, 0, 3, 4]]);
    const ev = [];
    const run = pick(rng, [[0, 1, 2, 4, 2, 1], [4, 2, 1, 0, 1, 2], [0, 2, 4, 5, 4, 2]]);
    chords.forEach((c, bar) => {
      const b = bar * 16, ch = triad(root + 12, MAJOR, c);
      hits('xxoxxoxxoxxoxxox').forEach(([s, g], i) => ev.push({ t: b + s, d: 1, v: 'lead', m: degree(root + 24, MAJOR, c + run[i % run.length]), g }));
      for (const s of [0, 2, 4, 6, 8, 10, 12, 14]) ev.push({ t: b + s, d: 1, v: 'pluck', m: ch[s % 4 === 0 ? 0 : 1], g: 0.55 }, { t: b + s, d: 1, v: 'pluck', m: ch[2], g: 0.45 });
      for (const [s, g] of hits('x...x..xx...x..x')) ev.push({ t: b + s, d: 2, v: 'bass', m: degree(root - 12, MAJOR, c + (s % 8 === 7 ? 4 : 0)), g });
      for (const [s, g] of hits('x.x.xxx.x.x.xxx.')) ev.push({ t: b + s, d: 1, v: s % 4 === 0 ? 'snare' : 'hat', g: s % 4 === 0 ? 0.5 : g * 0.6 });
      for (const s of [0, 8]) ev.push({ t: b + s, d: 1, v: 'kick', g: 0.8 });
    });
    return { bpm: 128, events: ev };
  },
  // Country music: a twangy guitar with slides, a bass on beats 1 and 3, a boom-chick drum and a fiddle.
  country(rng, root) {
    const chords = pick(rng, [[0, 3, 0, 4, 0, 3, 4, 0], [0, 0, 3, 3, 0, 4, 4, 0], [0, 3, 4, 0, 0, 3, 4, 0]]);
    const ev = [];
    chords.forEach((c, bar) => {
      const b = bar * 16, ch = triad(root + 12, MAJOR, c);
      ev.push({ t: b, d: 4, v: 'bass', m: degree(root - 12, MAJOR, c), g: 1 }, { t: b + 8, d: 4, v: 'bass', m: degree(root - 12, MAJOR, c + 4), g: 0.9 });
      for (const s of [4, 12]) for (const m of ch) ev.push({ t: b + s, d: 2, v: 'pluck', m, g: 0.45 });
      // A twangy lick at the end of each second bar: a slide up into the note.
      if (bar % 2) ev.push({ t: b + 13, d: 3, v: 'twang', m: ch[2] + 12, g: 0.8, from: ch[2] + 10 });
      for (const s of [0, 8]) ev.push({ t: b + s, d: 1, v: 'kick', g: 0.8 });
      for (const s of [4, 12]) ev.push({ t: b + s, d: 1, v: 'snare', g: 0.35 });
      for (const s of [2, 6, 10, 14]) ev.push({ t: b + s, d: 1, v: 'hat', g: 0.3 });
    });
    melody(ev, rng, chords, root + 12, MAJOR, 'fiddle', '....x.xx....x.xx', 2);
    return { bpm: 100, events: ev };
  },
  // Rwandan trap: a deep 808 bass that slides, fast hi-hats with rolls, a hard clap on beat 3 and a dark synth.
  trap(rng, root) {
    const chords = pick(rng, [[0, 5, 2, 6, 0, 5, 2, 6], [0, 0, 5, 6, 0, 0, 3, 4], [0, 3, 5, 4, 0, 3, 5, 6]]);
    const ev = [];
    chords.forEach((c, bar) => {
      const b = bar * 16;
      const low = degree(root - 12, MINOR, c);
      ev.push({ t: b, d: 7, v: 'sub', m: low, g: 1 });
      ev.push({ t: b + 7, d: 3, v: 'sub', m: low, g: 0.8 });
      ev.push({ t: b + 10, d: 6, v: 'sub', m: low, g: 0.9, slide: degree(root - 12, MINOR, chords[(bar + 1) % chords.length]) });
      for (const [s, g] of hits('xxxxxxoxxxxxxoxx')) ev.push({ t: b + s, d: 1, v: 'hat', g: g * 0.5 });
      if (rng() < 0.6) for (const k of [0, 1, 2]) ev.push({ t: b + 14 + k * (2 / 3), d: 0.5, v: 'hat', g: 0.4 }); // a hi-hat roll
      ev.push({ t: b + 8, d: 1, v: 'clap', g: 1 });
      ev.push({ t: b, d: 1, v: 'kick', g: 1 });
      if (rng() < 0.5) ev.push({ t: b + 11, d: 1, v: 'kick', g: 0.7 });
    });
    melody(ev, rng, chords, root + 12, MINOR, 'synth', 'x.......x...x...', 4);
    return { bpm: 140, events: ev };
  },
  // Rwandan gospel: warm choir chords (an organ sound), a happy keyboard line, hand claps on 2 and 4 and
  // a bass that walks up.
  gospel(rng, root) {
    const chords = pick(rng, [[0, 5, 3, 4, 0, 3, 4, 0], [0, 3, 5, 4, 0, 3, 4, 4], [0, 4, 5, 3, 0, 4, 3, 0]]);
    const ev = [];
    chords.forEach((c, bar) => {
      const b = bar * 16, ch = triad(root, MAJOR, c);
      for (const m of [...ch, ch[0] + 12]) ev.push({ t: b, d: 15, v: 'organ', m, g: 0.5 });
      for (const [s, g] of hits('x.x.xox.x.x.xox.')) ev.push({ t: b + s, d: 1, v: 'keys', m: ch[Math.floor(s / 2) % 3] + 12, g });
      hits('x..x..x.x..x.xx.').forEach(([s, g], i) => ev.push({ t: b + s, d: 2, v: 'bass', m: degree(root - 12, MAJOR, c + [0, 1, 2, 4, 2, 4, 5, 6][i]), g }));
      for (const s of [4, 12]) ev.push({ t: b + s, d: 1, v: 'clap', g: 0.8 });
      for (const s of [0, 8]) ev.push({ t: b + s, d: 1, v: 'kick', g: 0.7 });
    });
    return { bpm: 96, events: ev };
  },
  // Pop hits (KISS FM): four on the floor, open hats on the off beats, synth chords and a catchy line.
  kiss(rng, root) {
    const chords = pick(rng, [[0, 4, 5, 3, 0, 4, 5, 3], [5, 3, 0, 4, 5, 3, 0, 4], [0, 5, 3, 4, 0, 5, 3, 4]]);
    const ev = [];
    chords.forEach((c, bar) => {
      const b = bar * 16, ch = triad(root + 12, MAJOR, c);
      for (const s of [0, 4, 8, 12]) ev.push({ t: b + s, d: 1, v: 'kick', g: 1 });
      for (const s of [4, 12]) ev.push({ t: b + s, d: 1, v: 'clap', g: 0.7 });
      for (const s of [2, 6, 10, 14]) ev.push({ t: b + s, d: 1, v: 'hat', g: 0.55 });
      for (const s of [2, 6, 10, 14]) for (const m of ch) ev.push({ t: b + s, d: 1, v: 'synth', m, g: 0.35 });
      for (let s = 0; s < 16; s += 2) ev.push({ t: b + s, d: 1, v: 'bass', m: degree(root - 12, MAJOR, c) + (s % 4 ? 12 : 0), g: 0.8 });
    });
    melody(ev, rng, chords, root + 12, [0, 2, 4, 7, 9], 'lead', 'x.x...x.x.x.x...', 2, true);
    return { bpm: 120, events: ev };
  },
};

/**
 * A tune over the chords: a rhythm (one bar, 'x' = a note), notes from the chord or the scale, the
 * length of each note (steps). repeat: bars 3-4 copy bars 1-2 (a hook), as in pop songs.
 */
function melody(ev, rng, chords, root, scale, voice, rhythm, length, repeat = false) {
  const motif = [];
  for (let bar = 0; bar < chords.length; bar++) {
    if (repeat && bar % 4 >= 2) {
      for (const n of motif.filter((x) => x.bar === bar - 2)) ev.push({ ...n.e, t: n.e.t + 32 });
      continue;
    }
    let d = chords[bar] + pick(rng, [0, 2, 4]);
    for (const [s] of hits(rhythm)) {
      if (rng() < 0.2) continue; // a rest
      d += pick(rng, [-1, 1, 0, 2, -2]);
      const e = { t: bar * 16 + s, d: length, v: voice, m: degree(root, scale, ((d % 7) + 7) % 7), g: 0.8 + rng() * 0.2 };
      ev.push(e);
      motif.push({ bar, e });
    }
  }
}

// The root note (MIDI) of each track: a few keys for each station, so the tracks differ.
const KEYS = { impala: [55, 57, 60, 62], rumba: [55, 57, 59, 60], country: [52, 55, 57, 59], trap: [45, 48, 50, 52], gospel: [55, 57, 60, 62], kiss: [57, 60, 62, 64] };

/** The song of a track (station index, track index). */
export function songFor(stationIndex, trackIndex) {
  const st = RADIO.stations[stationIndex];
  const title = st.tracks[trackIndex % st.tracks.length];
  const rng = rngFrom(`${st.id}:${title}`);
  const root = KEYS[st.id][trackIndex % KEYS[st.id].length];
  const song = STYLES[st.id](rng, root);
  song.bpm = Math.round((st.bpm ?? song.bpm) * (0.97 + rng() * 0.06)); // each track a little faster or slower
  song.steps = BARS * STEPS_PER_BAR;
  song.events.sort((a, b) => a.t - b.t);
  return { ...song, station: st.name, title };
}

/** The station after this one (the last "station" is OFF: -1). */
export function nextStation(i) {
  return i + 1 >= RADIO.stations.length ? -1 : i + 1;
}

export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
