import { WORLD, SHOPS } from '../config.js';
import { PixelCanvas, hash2 } from './pixel-canvas.js';
import { drawText, textWidth } from './garage-sprites.js';
import { buildingLook } from './sprites.js';
import { finishFigure } from './palette.js';

// Shops and street life (Alp): barbershops, saloons, bars with funny names, butchers, repair shops,
// boutiques with mannequins out in front, and small buffets. Each chosen shop building gets a painted
// sign with a picture and a name; some shops are job places. No Phaser here.

const T = WORLD.tileMetres;

// Each kind: the board colour, the letters, the names (the bar names are from Alp and approved by
// Alp; the others are inventions in the same style), and a picture (8 × 8, see PICTURES).
export const SHOP_KINDS = {
  barber: { board: 0x1f4f9a, ink: 0xffffff, names: ['BARBER SHOP', 'SHARP LOOK BARBER', 'CUT AND GO', 'MODERN CUT', 'KING OF FADE'] },
  saloon: { board: 0x8a3a8a, ink: 0xffffff, names: ['GOOD VIBES SALOON', 'BEAUTY QUEEN SALOON', 'SHINE SALOON', 'MAMA SANDRA SALOON'] },
  bar: { board: 0x2f6a3a, ink: 0xf2e8a0, names: ['WHATSAPP BAR', 'FACEBOOK BAR', 'KIGALI COOL VIBES BAR', 'KIGALI COME AGAIN BAR', 'NETWORK FULL BAR', 'DATA BUNDLE BAR', 'LAST MOTO HOME BAR', 'NTA KIBAZO BAR', 'CHEZ MAMA PATIENCE BAR'] },
  butcher: { board: 0xf0ece0, ink: 0xa02020, names: ['BOUCHERIE', 'BUTCHERY', 'BOUCHERIE LA PAIX'] },
  shoes: { board: 0x6a4a2a, ink: 0xf2e8d0, names: ['CORDONNERIE', 'SHOE REPAIR'] },
  phones: { board: 0x202428, ink: 0x7fd0ff, names: ['PHONE REPAIR', 'ELECTRONICS REPAIR', 'SCREEN DOCTOR'] },
  boutique: { board: 0xe07a2a, ink: 0xffffff, names: ['BOUTIQUE', 'MAMA FASHION', 'KITENGE STYLE', 'SAPE BOUTIQUE'] },
  buffet: { board: 0xc0392b, ink: 0xf2e8a0, names: ['BUFFET', 'CHEZ MAMA BUFFET', 'BUFFET LA FAMILLE'] },
};

// Pictures in 8 × 8 pixels. Letters are colours; '.' is clear.
const PIC = {
  k: 0x101010, w: 0xf6f6f0, s: 0x6b4226, h: 0x1a1210, r: 0xc0302a, p: 0xf0a0a0, g: 0x9aa0a8,
  b: 0x5a3a20, y: 0xf0c040, n: 0x3a7fd0, o: 0xe07a2a, v: 0x7a3aa0, e: 0x4a9a40,
};
const PICTURES = {
  barber: ['.hhhhh..', 'hhhhhhh.', '.sssss..', 'sksssk..', '.sssss..', '..sss...', '.wwwww..', 'wwwwwww.'], // a head with a fresh cut
  saloon: ['.hhhhh..', 'hhsssshh', 'hskssksh', 'hhsssshh', 'h.sss.h.', 'h.....h.', 'h.vvv.h.', '.vvvvv..'], // long braids
  bar: ['...gg...', '...gg...', '..gwwg..', '..geeg..', '..geeg..', '..gyyg..', '..geeg..', '..gggg..'], // a bottle
  butcher: ['....ww..', '...wpw..', '.rrrrw..', 'rrprrr..', 'rrrrrr..', 'rrrprr..', '.rrrr...', '........'], // a piece of meat with a bone
  shoes: ['........', '........', 'bb......', 'bbb.....', 'bbbbbb..', 'bbbbbbb.', 'kkkkkkkk', '........'], // a shoe
  phones: ['.kkkkk..', '.knnnk..', '.knnnk..', '.knnnk..', '.knnnk..', '.kkkkk..', '.kkwkk..', '.kkkkk..'], // a phone
  boutique: ['..k..k..', '..vvvv..', '.vvvvvv.', '..vvvv..', '.vvvvvv.', 'vvvvvvvv', 'vvvvvvvv', '........'], // a dress
  buffet: ['........', '.y.e.o..', 'yyeeoo..', 'wwwwwwww', '.wwwwww.', '..wwww..', '........', '........'], // a plate of food
};

/** A painted shop sign: a board with the picture on the left and the name. Origin: the bottom middle. */
export function drawShopSign(kind, name) {
  const k = SHOP_KINDS[kind];
  const w = textWidth(name) + 17, h = 12;
  const c = new PixelCanvas(w + 2, h + 2);
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) c.setPixel(x, y, y === 1 || y === h || x === 1 || x === w ? 0x161616 : k.board);
  PICTURES[kind].forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && c.setPixel(3 + x, 3 + y, PIC[ch])));
  drawText(c, name, 13, 4, k.ink);
  return { canvas: c, groundX: (w + 2) / 2, groundY: h + 1 };
}

/**
 * A boutique mannequin, with strange proportions (Alp): v 0 is very tall with a tiny head, v 1 has a
 * big head on a short body. A kitenge dress. The canvas origin is at the feet.
 */
export const MANNEQUIN_CANVAS = { width: 10, height: 26, groundX: 5, groundY: 25 };
export function drawMannequin(v, dress = 0x8a3a8a) {
  const C = MANNEQUIN_CANVAS;
  const c = new PixelCanvas(C.width, C.height);
  const skin = 0xe8e4dc; // a white plastic body
  const legTop = v === 0 ? 14 : 19;
  for (let y = legTop; y < 25; y++) { c.setPixel(4, y, skin); c.setPixel(6, y, skin); }
  for (let y = 24; y < 26; y++) for (let x = 3; x < 8; x++) c.setPixel(x, y, 0x5a5a5a); // the stand
  const bodyTop = v === 0 ? 4 : 11;
  for (let y = bodyTop; y < legTop; y++) {
    const half = y < bodyTop + 3 ? 1 : 2 + Math.floor((y - bodyTop) / 4);
    for (let x = 5 - half; x <= 5 + half; x++) c.setPixel(x, y, (x + y) % 4 === 0 ? 0xf0c040 : dress);
  }
  if (v === 0) c.fillDisc(5, bodyTop - 1.5, 1, skin); // a tiny head
  else c.fillDisc(5, bodyTop - 3.5, 3.4, skin); // a big head
  finishFigure(c, false);
  return c;
}

/**
 * Choose the shops: the shop buildings that face a road or a pavement (the south or the east face, so
 * you see the sign). Seeded by position, so the map is the same each time. Returns
 * [{ id, kind, name, sign: { x, y, face }, front (the tile in front), stand (a road tile where customers
 * stand, or null), district }].
 */
export function shopFronts(world) {
  const groups = new Map();
  for (const b of world.blocks) {
    if (b.kind !== 'building') continue;
    const t = world.tile(b.tx, b.ty);
    if (t.landmark) continue;
    if (buildingLook(b, world).style !== 'shop') continue;
    const g = groups.get(b.groupId) ?? { id: b.groupId, x0: b.tx, x1: b.tx, y0: b.ty, y1: b.ty, top: 0, district: t.district };
    g.x0 = Math.min(g.x0, b.tx); g.x1 = Math.max(g.x1, b.tx); g.y0 = Math.min(g.y0, b.ty); g.y1 = Math.max(g.y1, b.ty);
    g.top = Math.max(g.top, b.floorLevel ?? b.baseLevel);
    groups.set(b.groupId, g);
  }
  const ROAD = ['pavement', 'tarmac', 'murram', 'cobble'];
  const free = (tx, ty) => { const t = world.tile(tx, ty); return t && !t.block && !t.solid && (ROAD.includes(t.surface) || t.surface === 'grass'); };
  const road = (tx, ty) => { const t = world.tile(tx, ty); return t && !t.block && !t.solid && ROAD.includes(t.surface); };
  const kinds = Object.entries(SHOPS.kinds);
  const out = [];
  for (const g of [...groups.values()].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    if (hash2(g.x0, g.y0, 401) >= SHOPS.share) continue;
    // The front: the first free tile (a road, a pavement or a yard) along the south side, else the east side.
    let face = null, midX = 0, midY = 0;
    for (let x = g.x0; x <= g.x1 && !face; x++) if (free(x, g.y1 + 1)) { face = 'south'; midX = x; }
    for (let y = g.y0; y <= g.y1 && !face; y++) if (free(g.x1 + 1, y)) { face = 'east'; midY = y; }
    if (!face) continue;
    // Where customers stand: the nearest road or pavement in front (up to 3 tiles out), or none.
    let stand = null;
    for (let d = 1; d <= 3 && !stand; d++) {
      const tx = face === 'south' ? midX : g.x1 + d, ty = face === 'south' ? g.y1 + d : midY;
      if (!free(tx, ty)) break;
      if (road(tx, ty)) stand = { x: tx + 0.5, y: ty + 0.5 };
    }
    // The kind: a weighted choice from SHOPS.kinds; the name: one from its list.
    let r = hash2(g.y0 * 7 + 3, g.x0 * 13 + 5, 402) * kinds.reduce((a, [, wgt]) => a + wgt, 0);
    let kind = kinds[0][0];
    for (const [k, wgt] of kinds) { if ((r -= wgt) < 0) { kind = k; break; } }
    const names = SHOP_KINDS[kind].names;
    const name = names[Math.floor(hash2(g.y0, g.x0, 403) * names.length)];
    const sign = face === 'south' ? { x: (midX + 0.5) * T, y: (g.y1 + 1) * T, face } : { x: (g.x1 + 1) * T, y: (midY + 0.5) * T, face };
    const front = face === 'south' ? { x: midX + 0.5, y: g.y1 + 1.5 } : { x: g.x1 + 1.5, y: midY + 0.5 };
    out.push({ id: `shop-${g.x0}-${g.y0}`, kind, name, groupId: g.id, sign, floor: g.top, stand, front, district: g.district, x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 });
  }
  return out;
}

/** Job places for some of the shops (tags: 'shop', and 'buffet' for a buffet: a food stop in hard mode). */
export function shopPlaces(shops) {
  return shops
    .filter((s, i) => s.stand && (s.kind === 'buffet' || i % SHOPS.placeEvery === 0))
    .map((s) => ({
      id: s.id, name: s.name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' '),
      x: s.stand.x, y: s.stand.y, tags: s.kind === 'buffet' ? ['shop', 'buffet'] : ['shop'], weight: 1, district: s.district,
    }));
}
