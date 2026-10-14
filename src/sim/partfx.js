import { PART_FX } from '../config.js';

// When the garage parts on your bike show their effects (design canvas "Moto Inziza: bike add-on
// effects"). No Phaser here: the scene gives the state of the bike each frame, and this module says
// which short effects start now (each with a cool-down) and which steady effects show.
//
// input: { parts: the ids you own, type: 'petrol' | 'electric', kmh, throttle, brake (0..1), bump (the
// bounce seconds of the bike), load (the bike load), surface, night (0..1), radio (true while it plays),
// wall (true when the bike knocked something this frame) }

const PASSENGER = ['passenger', 'visitor'];
const CARGO = ['bananas', 'rice'];

export function createPartFx() {
  return { cool: {}, bump: 0, load: 'none' };
}

/** The short effects that start now: 'crashbars', 'net', 'cushion', 'charger', 'pads', 'oldPads', 'regen', 'bearings', 'chain'. */
export function partFxTriggers(fx, input, dt) {
  const has = (id) => input.parts.includes(id);
  const out = [];
  for (const k in fx.cool) fx.cool[k] = Math.max(0, fx.cool[k] - dt);
  const fire = (name, when) => {
    if (!when || fx.cool[name] > 0) return;
    fx.cool[name] = PART_FX.cooldown;
    out.push(name);
  };
  const bumped = input.bump >= PART_FX.bumpMin && input.bump > fx.bump + 0.05;
  const passenger = PASSENGER.includes(input.load);
  const petrol = input.type === 'petrol';
  fire('crashbars', has('crashbars') && input.wall);
  fire('net', has('net') && CARGO.includes(input.load) && bumped);
  fire('cushion', has('cushion') && passenger && bumped);
  fire('charger', has('charger') && passenger && !PASSENGER.includes(fx.load)); // a passenger gets on
  // A hard brake: a clean stop with the ceramic pads, sparks with the old pads (Alp: yes, sparks).
  const hardBrake = input.brake >= PART_FX.hardBrake && input.kmh >= PART_FX.hardBrakeKmh;
  fire(has('pads') ? 'pads' : 'oldPads', hardBrake);
  fire('regen', has('regen') && !petrol && input.brake > 0.3 && input.kmh >= PART_FX.regenKmh);
  fire('bearings', has('bearings') && input.throttle === 0 && input.brake === 0 && input.kmh >= PART_FX.rollKmh);
  fire('chain', has('chain') && petrol && input.kmh >= PART_FX.chainKmh);
  fx.bump = input.bump;
  fx.load = input.load;
  return out;
}

/** The steady effects that show now (each frame): tread marks, wet spray, the speaker beat, the phone glow, small puffs. */
export function partFxSteady(input) {
  const has = (id) => input.parts.includes(id);
  const murram = input.surface === 'murram' || input.surface === 'murramWet';
  return {
    tread: has('tyres') && murram && input.kmh >= PART_FX.treadKmh,
    spray: has('tyres') && input.surface === 'murramWet' && input.kmh >= PART_FX.sprayKmh,
    beat: has('speaker') && !!input.radio,
    glow: has('charger') && input.night >= PART_FX.glowNight,
    smallPuffs: has('filter') && input.type === 'petrol',
    // Not a part: all bikes throw up dust on dry murram (Alp, 14 October 2026).
    dust: input.surface === 'murram' && input.kmh >= PART_FX.dustKmh,
  };
}
