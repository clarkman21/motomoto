import { COLOURS, UI_PALETTE } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';

// Small pixel icons for the retro HUD (9 × 9 px each), drawn from text maps.
// Letters are colours (see PALETTE); '.' is clear. Surge Yellow ('c') is only on the battery.

export const ICON_SIZE = 9;

const PALETTE = { ...UI_PALETTE.icon, c: COLOURS.ampersandYellow }; // the letters of the icon maps (config.js)

export const ICONS = {
  fuel: [
    '.kkkkk...',
    '.kwwwk.k.',
    '.kwwwk..k',
    '.krrrkk.k',
    '.krrrk.kk',
    '.krrrk.k.',
    '.krrrkkk.',
    '.krrrk...',
    'kkkkkkk..',
  ],
  battery: [
    '...kkk...',
    '.kkkkkkk.',
    '.kccccck.',
    '.kcckcck.',
    '.kckkkck.',
    '.kcckcck.',
    '.kccccck.',
    '.kccccck.',
    '.kkkkkkk.',
  ],
  // A simple open-end wrench (Alp, 14 October 2026: the service icon).
  spanner: [
    '.....kwk.',
    '....kwk.k',
    '...kwwkkw',
    '....kwwsk',
    '...kkwsk.',
    '..kwskk..',
    '.kwsk....',
    'kwsk.....',
    'ksk......',
  ],
  food: [ // a bowl with steam (rider energy, medium and hard modes)
    '..w..w...',
    '.w..w..w.',
    '..w..w...',
    'kkkkkkkkk',
    'koooooook',
    'kwwwwwwwk',
    '.kwwwwwk.',
    '..kkkkk..',
    '.........',
  ],
  wc: [ // a water drop (the bathroom need, hard mode)
    '....k....',
    '...kbk...',
    '..kbbbk..',
    '.kbbbbbk.',
    'kbbwbbbbk',
    'kbwbbbbbk',
    'kbbbbbbbk',
    '.kbbbbbk.',
    '..kkkkk..',
  ],
  coin: [
    '..kkkkk..',
    '.kyyyyyk.',
    'kyywwyyyk',
    'kywyyyyok',
    'kywyyyyok',
    'kyyyyyyok',
    'kyyyyyook',
    '.kyooook.',
    '..kkkkk..',
  ],
  clock: [
    '..kkkkk..',
    '.kwwwwwk.',
    'kwwwkwwwk',
    'kwwwkwwwk',
    'kwwwkkkwk',
    'kwwwwwwwk',
    'kwwwwwwwk',
    '.kwwwwwk.',
    '..kkkkk..',
  ],
  cog: [
    '.k.kkk.k.',
    'ksksssksk',
    '.ksssssk.',
    'ksssksssk',
    'kssk.kssk',
    'ksssksssk',
    '.ksssssk.',
    'ksksssksk',
    '.k.kkk.k.',
  ],
  star: [
    '....k....',
    '...kyk...',
    'kkkkyykkk',
    'kyyyyyyyk',
    '.kyyyyyk.',
    '..kyyyk..',
    '.kyykyyk.',
    '.kyk.kyk.',
    '.kk...kk.',
  ],
  person: [
    '...kkk...',
    '..kwwwk..',
    '..kwwwk..',
    '...kkk...',
    '.kkbbbkk.',
    'kbbbbbbbk',
    'kbkbbbkbk',
    '..kbkbk..',
    '..kk.kk..',
  ],
  sack: [
    '...kkk...',
    '..ktktk..',
    '...ktk...',
    '.kkttkk..',
    'kttttttk.',
    'kttnttnk.',
    'kttttttk.',
    'kttttttk.',
    '.kkkkkk..',
  ],
  bananas: [
    '.......kk',
    '......kgk',
    '.....kggk',
    '...kkggk.',
    '.kkggggk.',
    'kggggdkk.',
    'kgggdk...',
    '.kkkk....',
    '.........',
  ],
  pin: [
    '..kkkkk..',
    '.kgggggk.',
    'kgggwgggk',
    'kggwwwggk',
    'kgggwgggk',
    '.kgggggk.',
    '..kgggk..',
    '...kgk...',
    '....k....',
  ],
  flame: [
    '....k....',
    '...kok...',
    '..kook.k.',
    '..kooookk',
    '.kooyyook',
    '.koyyyyok',
    'kooyyyook',
    '.kooooook',
    '..kkkkkk.',
  ],
  mountain: [
    '.........',
    '....k....',
    '...kwk...',
    '..kwnnk..',
    '..knnnk.k',
    '.knnnnkdk',
    '.knnnkddk',
    'knnnkdddk',
    'kkkkkkkkk',
  ],
  pause: [
    '.........',
    '.kkk.kkk.',
    '.kwk.kwk.',
    '.kwk.kwk.',
    '.kwk.kwk.',
    '.kwk.kwk.',
    '.kwk.kwk.',
    '.kkk.kkk.',
    '.........',
  ],
};

/** All icons in one sheet (one row). Returns { canvas, frames: { name: { x, y, w, h } } }. */
export function drawIconSheet() {
  const names = Object.keys(ICONS);
  const c = new PixelCanvas(names.length * (ICON_SIZE + 1), ICON_SIZE);
  const frames = {};
  names.forEach((name, i) => {
    const x0 = i * (ICON_SIZE + 1);
    ICONS[name].forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.' && PALETTE[ch] !== undefined) c.setPixel(x0 + x, y, PALETTE[ch]);
    }));
    frames[name] = { x: x0, y: 0, w: ICON_SIZE, h: ICON_SIZE };
  });
  return { canvas: c, frames };
}
