import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { drawBike, BIKE_LOADS, drawSpeedSign, drawRoadSign, drawCamera, drawBlock } from '../src/world/sprites.js';
import { drawIconSheet } from '../src/world/hud-icons.js';
import { drawBoard, drawNoMotoSign, drawCone, drawBarrier } from '../src/world/roadevent-sprites.js';
import { offPalette, paletteColours } from '../src/world/palette.js';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { UI_PALETTE, COLOURS, PALETTE } from '../src/config.js';

// Design system step 2: the player moto, the trees, the signs, the HUD icons and the menus use only
// the colour tokens in config.js (the world with the light rule; the UI from UI_PALETTE).

const hex = (list) => list.map((c) => c.toString(16).padStart(6, '0'));
const allowed = paletteColours();

describe('design system: palette everywhere', () => {
  it('the player moto, the hired and rival motos, in all directions and with all loads', () => {
    for (const type of ['petrol', 'electric', 'fleet', 'rival']) {
      for (let f = 0; f < 16; f++) {
        for (const load of BIKE_LOADS) expect(hex(offPalette(drawBike(type, f, load), allowed)), `${type} ${f} ${load}`).toEqual([]);
        expect(hex(offPalette(drawBike(type, f, 'none', true, 'push1'), allowed))).toEqual([]);
      }
    }
    for (const type of ['parkedRed', 'parkedBlue', 'parkedBlack']) expect(hex(offPalette(drawBike(type, 3, 'none', false), allowed))).toEqual([]);
  });

  it('all the trees (fig, acacia, jacaranda, avocado, palm)', () => {
    const world = new World(buildKigaliMap());
    const trees = world.blocks.filter((b) => b.kind === 'tree');
    for (let i = 0; i < trees.length; i += 7) expect(hex(offPalette(drawBlock(trees[i], world).canvas, allowed))).toEqual([]);
  });

  it('the road signs, the cameras and the street event signs', () => {
    const signs = [drawCamera(), ...[20, 30, 40, 50, 60, 80].map(drawSpeedSign), drawRoadSign('bump'), drawRoadSign('crossing'),
      drawBoard('ONE WAY', PALETTE.kBlue, PALETTE.cream).canvas, drawBoard('ROAD WORKS', PALETTE.orange, PALETTE.ink).canvas,
      drawNoMotoSign().canvas, drawCone(), drawBarrier().canvas];
    for (const c of signs) expect(hex(offPalette(c, allowed))).toEqual([]);
  });

  it('the HUD icons use only the UI icon colours (Surge Yellow only on the battery)', () => {
    const ok = new Set([...Object.values(UI_PALETTE.icon), COLOURS.ampersandYellow]);
    expect(hex(offPalette(drawIconSheet().canvas, ok))).toEqual([]);
  });

  it('the HUD, the menus and the day end have no colour numbers of their own (all from UI_PALETTE)', () => {
    for (const f of ['retro-ui', 'HudScene', 'MenuScene', 'DayEndScene', 'GarageScene']) {
      const src = readFileSync(new URL(`../src/scenes/${f}.js`, import.meta.url), 'utf8');
      expect(src.match(/0x[0-9a-fA-F]{6}\b/g) ?? [], f).toEqual([]);
    }
  });
});
