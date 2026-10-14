import { describe, it, expect } from 'vitest';
import { PART_FX } from '../src/config.js';
import { createPartFx, partFxTriggers, partFxSteady } from '../src/sim/partfx.js';

const base = { parts: [], type: 'petrol', kmh: 0, throttle: 0, brake: 0, bump: 0, load: 'none', surface: 'tarmac', night: 0, radio: false, wall: false };
const step = (fx, over, dt = 0.016) => partFxTriggers(fx, { ...base, ...over }, dt);

describe('Effects of the garage parts', () => {
  it('a part shows its effect only when you own it, at its trigger', () => {
    const fx = createPartFx();
    expect(step(fx, { wall: true })).toEqual([]);
    expect(step(fx, { parts: ['crashbars'], wall: true })).toEqual(['crashbars']);
  });

  it('each effect waits for its cool-down before it plays again', () => {
    const fx = createPartFx();
    const on = { parts: ['crashbars'], wall: true };
    expect(step(fx, on)).toEqual(['crashbars']);
    expect(step(fx, on, 1)).toEqual([]);
    expect(step(fx, on, PART_FX.cooldown)).toEqual(['crashbars']);
  });

  it('a bump with cargo shows the net; with a passenger, the cushion; the washboard does not', () => {
    const fx = createPartFx();
    expect(step(fx, { parts: ['net', 'cushion'], load: 'rice', bump: 0.12 })).toEqual([]); // murram washboard
    step(fx, { parts: ['net', 'cushion'], load: 'rice', bump: 0 });
    expect(step(fx, { parts: ['net', 'cushion'], load: 'rice', bump: 0.25 })).toEqual(['net']);
    const fx2 = createPartFx();
    expect(step(fx2, { parts: ['net', 'cushion'], load: 'passenger', bump: 0.3 })).toContain('cushion');
  });

  it('the charger shows when a passenger gets on, once', () => {
    const fx = createPartFx();
    step(fx, { parts: ['charger'] });
    expect(step(fx, { parts: ['charger'], load: 'visitor' })).toEqual(['charger']);
    expect(step(fx, { parts: ['charger'], load: 'visitor' }, PART_FX.cooldown + 1)).toEqual([]);
  });

  it('a hard brake: ceramic pads stop clean, old pads make sparks; the regen tune only on the Alpha', () => {
    const hard = { kmh: 40, brake: 1 };
    expect(step(createPartFx(), hard)).toEqual(['oldPads']);
    expect(step(createPartFx(), { ...hard, parts: ['pads'] })).toEqual(['pads']);
    expect(step(createPartFx(), { ...hard, parts: ['pads', 'regen'] })).toEqual(['pads']); // petrol: no regen
    expect(step(createPartFx(), { ...hard, parts: ['pads', 'regen'], type: 'electric' })).toEqual(['pads', 'regen']);
    expect(step(createPartFx(), { kmh: 10, brake: 1 })).toEqual([]); // too slow for a hard brake
  });

  it('bearings when you roll, the chain glint at speed (petrol only)', () => {
    expect(step(createPartFx(), { parts: ['bearings'], kmh: 30 })).toEqual(['bearings']);
    expect(step(createPartFx(), { parts: ['bearings'], kmh: 30, throttle: 1 })).toEqual([]);
    expect(step(createPartFx(), { parts: ['chain'], kmh: 40, throttle: 1 })).toEqual(['chain']);
    expect(step(createPartFx(), { parts: ['chain'], kmh: 40, throttle: 1, type: 'electric' })).toEqual([]);
  });

  it('steady effects: tread marks and spray on murram, the beat, the night glow, small puffs', () => {
    const all = { ...base, parts: ['tyres', 'speaker', 'charger', 'filter'] };
    expect(partFxSteady({ ...all, surface: 'murram', kmh: 20 })).toMatchObject({ tread: true, spray: false, beat: false, glow: false, smallPuffs: true });
    expect(partFxSteady({ ...all, surface: 'murramWet', kmh: 20, radio: true, night: 0.8 })).toMatchObject({ tread: true, spray: true, beat: true, glow: true });
    expect(partFxSteady({ ...all, surface: 'tarmac', kmh: 20, type: 'electric' })).toMatchObject({ tread: false, smallPuffs: false });
  });
});
