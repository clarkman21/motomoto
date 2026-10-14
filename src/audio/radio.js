import { RADIO } from '../config.js';
import { songFor, nextStation, midiToHz } from './songs.js';

// Radio Inziza: plays the songs of audio/songs.js with Web Audio (chiptune voices: square, triangle,
// sawtooth and noise). It uses the audio of the engine (EngineSound), so the sound switch (V) mutes it
// too. The ride calls tick() each frame while the radio may play; when the ticks stop (a menu, the garage,
// the day end), the music fades out by itself. Each track plays for about trackSeconds, then the next one.

const LOOKAHEAD = 0.4; // seconds of notes scheduled ahead
const TRACK_SECONDS = 48;

export class Radio {
  constructor(engineSound) {
    this.sound = engineSound;
    this.station = -1; // -1: OFF
    this.track = 0;
    this.volume = RADIO.volume;
    this.song = null;
    this.aliveUntil = 0;
    this.playing = false;
    this.onTrack = null; // (station index, track index) → the HUD chip
    this.timer = null;
  }

  get ctx() {
    return this.sound.ctx;
  }

  #setup() {
    const ctx = this.ctx;
    if (!ctx || this.out) return !!ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(this.sound.master);
    // White noise for the drums (1 s, made once).
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.out && this.playing) this.out.gain.setTargetAtTime(this.volume * 0.5, this.ctx.currentTime, 0.1);
  }

  /** Tune in: station index (or -1 for OFF), track index. */
  tune(station, track = 0) {
    this.station = station;
    this.track = track;
    this.song = station >= 0 ? songFor(station, track) : null;
    this.songStart = null; // set at the next schedule
    this.trackStart = null;
    if (station >= 0) this.onTrack?.(station, track);
  }

  /** N: the next station (after the last one: OFF). Returns the new station index. */
  next() {
    this.tune(nextStation(this.station), 0);
    if (this.station >= 0) this.#ident();
    return this.station;
  }

  /** Each frame while the radio may play (a speaker on the bike, the ride runs). */
  tick() {
    if (this.station < 0 || !this.#setup()) return;
    this.aliveUntil = performance.now() + 900;
    if (!this.timer) this.timer = setInterval(() => this.#schedule(), 60);
    if (!this.playing) {
      this.playing = true;
      this.songStart = null; // start again from the next step
      this.out.gain.cancelScheduledValues(this.ctx.currentTime);
      this.out.gain.setTargetAtTime(this.volume * 0.5, this.ctx.currentTime, 0.3);
    }
  }

  /** Stop now (the speaker is gone, or OFF). */
  stop() {
    this.#fade();
    clearInterval(this.timer);
    this.timer = null;
  }

  #fade() {
    if (!this.playing) return;
    this.playing = false;
    if (this.out) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
  }

  #schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.song) return this.stop();
    if (performance.now() > this.aliveUntil) {
      this.#fade(); // no ticks: a menu or a screen is open
      return;
    }
    const song = this.song, step = 60 / song.bpm / 4;
    const now = ctx.currentTime;
    if (this.songStart == null) {
      this.songStart = now + 0.08 - (this.pos ?? 0) * step;
      this.trackStart ??= now;
      this.loop = Math.floor((this.pos ?? 0) / song.steps);
    }
    // The next track after about TRACK_SECONDS, at the end of a loop.
    const loopEnd = this.songStart + (this.loop + 1) * song.steps * step;
    if (loopEnd < now + LOOKAHEAD && loopEnd - this.trackStart > TRACK_SECONDS) {
      const track = (this.track + 1) % RADIO.stations[this.station].tracks.length;
      this.pos = 0;
      this.tune(this.station, track);
      this.songStart = loopEnd + 0.4; // after the ident
      this.trackStart = loopEnd;
      this.loop = 0;
      this.#ident(loopEnd);
      return;
    }
    // Schedule the events up to now + LOOKAHEAD.
    const until = now + LOOKAHEAD;
    this.pos ??= 0;
    for (;;) {
      const abs = this.songStart + this.pos * step;
      if (abs >= until) break;
      const loopStep = this.pos - Math.floor(this.pos / song.steps) * song.steps;
      const from = loopStep, to = loopStep + 1;
      for (const e of song.events) {
        if (e.t < from) continue;
        if (e.t >= to) break;
        const t = abs + (e.t - from) * step;
        if (t >= now - 0.01) this.#note(e, t, step);
      }
      this.pos += 1;
      this.loop = Math.floor(this.pos / song.steps);
    }
  }

  /** The station ident: three short notes between the tracks. */
  #ident(at) {
    if (!this.#setup()) return;
    const t0 = at ?? this.ctx.currentTime + 0.02;
    [76, 79, 84].forEach((m, i) => this.#note({ v: 'keys', m, g: 0.7, d: 1 }, t0 + i * 0.09, 0.09));
  }

  #env(t, attack, hold, release, peak) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(this.out);
    return g;
  }

  #osc(type, hz, t, end, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  }

  #noiseHit(t, len, filterType, hz, peak) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = hz;
    src.connect(f).connect(this.#env(t, 0.002, 0, len, peak));
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.02);
  }

  /** One note (or drum hit) e at time t. step: seconds per step. */
  #note(e, t, step) {
    const len = Math.max(0.05, e.d * step);
    const g = e.g ?? 1;
    const hz = e.m != null ? midiToHz(e.m) : 0;
    const filtered = (cutoff, env) => {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      f.connect(env);
      return f;
    };
    switch (e.v) {
      case 'kick': {
        const env = this.#env(t, 0.002, 0.02, 0.18, 0.5 * g);
        const o = this.#osc('sine', 150, t, t + 0.25, env);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
        break;
      }
      case 'snare': this.#noiseHit(t, 0.12, 'bandpass', 1800, 0.22 * g); this.#osc('triangle', 190, t, t + 0.08, this.#env(t, 0.002, 0, 0.07, 0.08 * g)); break;
      case 'hat': this.#noiseHit(t, 0.035, 'highpass', 7000, 0.09 * g); break;
      case 'shaker': this.#noiseHit(t, 0.05, 'highpass', 5000, 0.06 * g); break;
      case 'clap': for (const k of [0, 0.012, 0.024]) this.#noiseHit(t + k, 0.09, 'bandpass', 1300, 0.18 * g); break;
      case 'pluck': this.#osc('square', hz, t, t + len + 0.1, filtered(2600, this.#env(t, 0.004, 0, Math.min(0.3, len + 0.05), 0.045 * g))); break;
      case 'lead': this.#osc('square', hz, t, t + len + 0.08, filtered(3800, this.#env(t, 0.004, len * 0.3, len * 0.7 + 0.05, 0.04 * g))); break;
      case 'keys': this.#osc('square', hz, t, t + len + 0.15, filtered(3000, this.#env(t, 0.004, 0, len + 0.12, 0.04 * g))); break;
      case 'horn': {
        const env = this.#env(t, 0.04, len * 0.6, len * 0.4 + 0.05, 0.05 * g);
        this.#osc('sawtooth', hz, t, t + len + 0.1, filtered(1700, env));
        this.#osc('sawtooth', hz, t, t + len + 0.1, filtered(1700, env), 9);
        break;
      }
      case 'fiddle': {
        const env = this.#env(t, 0.05, len * 0.6, len * 0.4 + 0.06, 0.04 * g);
        const o = this.#osc('sawtooth', hz, t, t + len + 0.12, filtered(2400, env));
        const vib = this.ctx.createOscillator(), depth = this.ctx.createGain();
        vib.frequency.value = 5.5;
        depth.gain.value = hz * 0.012;
        vib.connect(depth).connect(o.frequency);
        vib.start(t);
        vib.stop(t + len + 0.12);
        break;
      }
      case 'twang': {
        const o = this.#osc('square', midiToHz(e.from ?? e.m), t, t + len + 0.1, filtered(2200, this.#env(t, 0.004, len * 0.5, len * 0.5 + 0.08, 0.05 * g)));
        o.frequency.exponentialRampToValueAtTime(hz, t + Math.min(0.12, len * 0.5)); // the slide up
        break;
      }
      case 'synth': this.#osc('sawtooth', hz, t, t + len + 0.1, filtered(1100, this.#env(t, 0.01, len * 0.5, len * 0.5 + 0.08, 0.04 * g))); break;
      case 'organ': {
        const env = this.#env(t, 0.12, len * 0.7, len * 0.3 + 0.1, 0.022 * g);
        for (const [mul, k] of [[1, 1], [2, 0.5], [3, 0.25]]) this.#osc(k === 1 ? 'triangle' : 'sine', hz * mul, t, t + len + 0.2, env);
        break;
      }
      case 'bass': this.#osc('triangle', hz, t, t + len + 0.05, this.#env(t, 0.005, len * 0.6, len * 0.4 + 0.03, 0.14 * g)); break;
      case 'sub': {
        const o = this.#osc('sine', hz, t, t + len + 0.1, this.#env(t, 0.005, len * 0.5, len * 0.5 + 0.08, 0.28 * g));
        if (e.slide != null) o.frequency.exponentialRampToValueAtTime(midiToHz(e.slide), t + len); // the 808 slide
        break;
      }
      default: break;
    }
  }
}
