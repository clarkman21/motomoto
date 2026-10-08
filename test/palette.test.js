import { describe, it, expect } from 'vitest';
import { drawVehicle, VEHICLE_VARIANTS, drawPerson, drawWaver, PERSON_LOOKS, PERSON_CANVAS } from '../src/world/vehicle-sprites.js';
import { drawOfficer } from '../src/world/police.js';
import { drawAttendant, ATTENDANT_FRAMES } from '../src/world/attendant-sprites.js';
import { offPalette, paletteColours, tone, faceTone, finishFigure, mirror } from '../src/world/palette.js';
import { PixelCanvas } from '../src/world/pixel-canvas.js';
import { TRAFFIC, PALETTE, LIGHT } from '../src/config.js';

const hex = (list) => list.map((c) => c.toString(16).padStart(6, '0'));

describe('visual design system', () => {
  const allowed = paletteColours();

  it('each palette colour has 3 tones from the light rule (top left light)', () => {
    expect(LIGHT.top).toBeGreaterThan(LIGHT.left);
    expect(LIGHT.left).toBeGreaterThan(LIGHT.right);
    expect(tone(0x808080, 'top')).toBe(0x808080);
    expect(faceTone(0, 1)).toBe('left'); // a face that looks to +y shows on the left of the screen
    expect(faceTone(1, 0)).toBe('right');
  });

  it('the traffic uses only palette colours, in all 16 directions', () => {
    for (const kind of ['car', 'bus', 'truck']) {
      for (let v = 0; v < VEHICLE_VARIANTS[kind].length; v++) {
        for (let f = 0; f < 16; f++) expect(hex(offPalette(drawVehicle(kind, v, f), allowed)), `${kind} ${v} ${f}`).toEqual([]);
      }
    }
  });

  it('the sim has the same number of variants as the sprites', () => {
    for (const kind of ['car', 'bus', 'truck']) expect(TRAFFIC.kinds[kind].variants).toBe(VEHICLE_VARIANTS[kind].length);
  });

  it('the people, the police and the attendants use only palette colours', () => {
    const figures = [
      ...PERSON_LOOKS.flatMap((l) => [drawPerson(l, 0, 0), drawPerson(l, 1, 1, true), drawWaver(l)]),
      ...[0, 1, 2, 3].flatMap((f) => [drawOfficer(f), drawOfficer(f, true)]),
      ...ATTENDANT_FRAMES.flatMap((f) => [drawAttendant('fuel', f), drawAttendant('swap', f, true)]),
    ];
    for (const c of figures) expect(hex(offPalette(c, allowed))).toEqual([]);
  });

  it('the left frames have the dark edge on the right too (the light does not turn with the figure)', () => {
    const c = new PixelCanvas(5, 1);
    for (let x = 1; x <= 3; x++) c.setPixel(x, 0, PALETTE.red);
    finishFigure(c, true);
    const at = (x) => (c.data[x * 4] << 16) | (c.data[x * 4 + 1] << 8) | c.data[x * 4 + 2];
    expect(at(3)).toBe(tone(PALETTE.red, 'right'));
    expect(at(1)).toBe(PALETTE.red);
    expect(at(0)).toBe(PALETTE.ink); // the outline
  });

  it('a walker looks the other way in the left frame', () => {
    const r = drawPerson(PERSON_LOOKS[0], 0, 0), l = drawPerson(PERSON_LOOKS[0], 0, 0, true);
    expect(l.width).toBe(PERSON_CANVAS.width);
    expect(Array.from(mirror(r).data)).not.toEqual(Array.from(l.data)); // not a plain flip: the shade stays on the right
  });
});
