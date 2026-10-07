// Engine and horn sounds made with Web Audio, so the prototype needs no audio files.
// Petrol: a rough, low sawtooth. Electric: a quiet, high hum.
// Browsers start audio only after the first key press or tap.

export class EngineSound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  /** Call from a user input handler. */
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = (this.ctx = new AudioCtx());
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.master.connect(ctx.destination);

    // Petrol engine: sawtooth through a low pass filter, with a wobble for roughness.
    this.petrolOsc = ctx.createOscillator();
    this.petrolOsc.type = 'sawtooth';
    this.petrolFilter = ctx.createBiquadFilter();
    this.petrolFilter.type = 'lowpass';
    this.petrolFilter.frequency.value = 400;
    this.petrolGain = ctx.createGain();
    this.petrolGain.gain.value = 0;
    this.wobble = ctx.createOscillator();
    this.wobble.frequency.value = 9;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 6;
    this.wobble.connect(wobbleDepth).connect(this.petrolOsc.frequency);
    this.petrolOsc.connect(this.petrolFilter).connect(this.petrolGain).connect(this.master);

    // Electric motor: sine whine.
    this.elecOsc = ctx.createOscillator();
    this.elecOsc.type = 'sine';
    this.elecGain = ctx.createGain();
    this.elecGain.gain.value = 0;
    this.elecOsc.connect(this.elecGain).connect(this.master);

    for (const o of [this.petrolOsc, this.wobble, this.elecOsc]) o.start();
  }

  /** Stop all sound for a while (the pause menu). start() makes it play again. */
  pause() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  /** revs 0..1 (petrol: of the rev limit in this gear; electric: of top speed), throttle 0..1 */
  update(type, revs, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = 0.08;
    if (type === 'petrol') {
      this.petrolOsc.frequency.setTargetAtTime(34 + revs * 95 + throttle * 10, t, k);
      this.petrolFilter.frequency.setTargetAtTime(300 + throttle * 500 + revs * 400, t, k);
      this.petrolGain.gain.setTargetAtTime(0.1 + throttle * 0.12, t, k);
      this.elecGain.gain.setTargetAtTime(0, t, k);
    } else {
      this.elecOsc.frequency.setTargetAtTime(180 + revs * 520, t, k);
      this.elecGain.gain.setTargetAtTime(revs > 0.01 || throttle > 0 ? 0.03 + throttle * 0.04 : 0, t, k);
      this.petrolGain.gain.setTargetAtTime(0, t, k);
    }
  }

  /** Engine quiet (the shift is over, or a menu is open). The next update() starts it again. */
  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.petrolGain.gain.setTargetAtTime(0, t, 0.05);
    this.elecGain.gain.setTargetAtTime(0, t, 0.05);
  }

  /**
   * A short chiptune jingle. kind: 'shiftEnd' (the shift is over), 'levelUp' (a milestone),
   * 'gameOver' (out of cash), 'reward' (money for the family).
   */
  jingle(kind) {
    if (!this.ctx || !this.enabled) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // [note (semitones from A4), length in beats]; one beat = 0.12 s.
    const TUNES = {
      shiftEnd: [[3, 1], [7, 1], [10, 1], [15, 3]],
      levelUp: [[3, 1], [7, 1], [10, 1], [15, 2], [10, 1], [15, 1], [19, 4]],
      gameOver: [[10, 2], [6, 2], [3, 2], [-2, 5]],
      reward: [[15, 1], [19, 2]],
    };
    const tune = TUNES[kind];
    if (!tune) return;
    const beat = 0.12;
    let t = this.ctx.currentTime + 0.05;
    for (const [n, len] of tune) {
      const f = 440 * 2 ** (n / 12);
      for (const [type, mul, vol] of [['square', 1, 0.07], ['triangle', 0.5, 0.09]]) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = f * mul;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len * beat * 0.95);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + len * beat);
      }
      t += len * beat;
    }
  }

  /** A short menu sound: 'move' (the cursor moves), 'select' or 'back'. */
  blip(kind) {
    if (!this.ctx || !this.enabled) return;
    const notes = { move: [[1320, 0.04]], select: [[880, 0.05], [1760, 0.07]], back: [[660, 0.05], [440, 0.07]] }[kind] ?? [];
    let t = this.ctx.currentTime + 0.01;
    for (const [f, len] of notes) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + len);
      t += len;
    }
  }

  horn() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.setValueAtTime(0.12, t + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    gain.connect(this.master);
    for (const f of [415, 523]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(gain);
      o.start(t);
      o.stop(t + 0.36);
    }
  }
}
