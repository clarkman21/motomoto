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

/** A canvas sheared 2:1 to lie on a wall: a south face goes down to the right, an east face down to the left. */
export function shearOnWall(src, face) {
  const w = src.width, h = src.height;
  const shift = (x) => (face === 'south' ? Math.floor(x / 2) : Math.floor((w - 1 - x) / 2));
  const c = new PixelCanvas(w, h + Math.ceil(w / 2));
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      if (src.data[i + 3]) c.setPixel(x, y + shift(x), (src.data[i] << 16) | (src.data[i + 1] << 8) | src.data[i + 2], src.data[i + 3]);
    }
  }
  const mid = Math.floor(w / 2);
  return { canvas: c, groundX: mid, groundY: h - 1 + shift(mid) };
}

// The hand-painted wall pictures (Alp, design canvas "Rwandan shop fronts"; larger after Alp's review):
// 28 × 20 pixels, flat colours, a dark outline. They fill a side wall of 1 tile. Letters are colours;
// '.' is clear. Made with a small shape script (circles, boxes, lines), then checked by eye.
const MURAL_PAL = {
  k: 0x161616, h: 0x1a1210, s: 0x7a4a2a, d: 0x5a3420, w: 0xf6f6f0, g: 0xa8aeb6, G: 0x5a6068, r: 0xc0302a,
  m: 0xa82a2a, n: 0x2f6fb0, o: 0xe07a2a, y: 0xd89a20, b: 0x6b4226, v: 0x8a3a8a, c: 0x7fd0ff, f: 0xf2e8c8, p: 0xd86a6a,
};
const MURALS = {
  barber: ['............................', '.........hhhhhhh.......ggg..', '.......hhhhhhhhhhh.....GGG..', '......hhhhhhhhhhhhh....GgG..', '......hhhhhhhhhhhhh....GgG..', '.....hhhhhhhhhhhhhhh...GgG..', '......hhhhhhhhhhhhhs...GgG..', '......ddhhhhhhhhhhhs...GGG..', '......ddddhhhhhhkkss....k...', '......dddshhhhhhsssss...k...', '......ddsdsssssssssss..k....', '......ddssssssssssss...k....', '.......sssssssssrrr...k.....', '.......ssssssssssss...k.....', '........ssssssssss..........', '..........ssssss............', '........wwwwwwwwww..........', '....wwwwwwwwwwwwwwwwww......', '..wwwwwwwwwwwwwwwwwwwwww....', '.wwwwwwwwwwwwwwwwwwwwwwww...'],
  saloon: ['...........hhhhhh...........', '.........hhhhhhhhhh.........', '.......hhhhhhhhhhhhhh.......', '......hhhhhhhhhhhhhhhh......', '......hhhhhsssssshhhhh......', '......hhhhsssssssshhhh......', '.....hhhhsssssssssshhhh.....', '.....bbhhsssssssssshbbh.....', '.....hbbhsskssssksshhbb.....', '.....hhhsssssssssssshhh.....', '.....bbhhssssddsssshbbh.....', '.....hbbossssddssssohbb.....', '.....hhh.ssssssssss.hhh.....', '.....bbh..ssrrrrss..bbh.....', '.....hbb...ssssss...hbb.....', '.....hhh....ssss....hhh.....', '.....b.h....ssss....b.h.....', '.....h.bvvvvvvvvvvvvh.b.....', '.......vvovvovvovvovv.......', '......vvvvvvvvvvvvvvvv......'],
  butcher: ['............................', '............................', '............................', '...wwwwwwwwwwwwwwwwwbbbbbb..', '...gggggggggggggggggbbfbfb..', '....ggggggggggggggggbbbbbb..', '............................', '............................', '.........mmmmmmmmmm.........', '......mmmmmmmmmmmmmmmm......', '....mwwwwmmmmmmmmmmmmmmm....', '...mmwwwwmmmmmppmmmmmmmmm...', '..mmwwffwwmmmmmmppppmmmmmm..', '..mmmwwwwmmmmmmmmmmmppmmmm..', '..mmmwwwwpppmmmmmmmmmmmmmm..', '...mmmmmmmmmpmmmmmmmmmmmm...', '....mmwwwwwwwwwwwwwwwwpm....', '...wwwwwwwwwwwwwwwwwwwwww...', '......wwwwwwwwwwwwwwww......', '............................'],
  buffet: ['............................', '.....rr.....................', '.....rrrr...................', '.....rrrr............w......', '....wwwwww...........ww.....', '....wwwwww...........www....', '..oowwkwwwwwwwwwwww..wwww...', '..oowwwwwwwwwwwwwwwwwwwwww..', '....rwwwwwwwwwwwwwwwwwwww...', '....rwwwwwwwwffffffwwww.....', '....r.wwwwwwffffffffwww.....', '......wwwwwffffffffffwww....', '.......wwwwwffffffffwww.....', '.......wwwwwwffffffwwww.....', '........wwwwwwwwwwwwww......', '.........wwwwwwwwwwww.......', '...........wwwwwwww.........', '............o....o..........', '............o....o..........', '...........ooo..ooo.........'],
  bar: ['......yy....................', '......bb....................', '......bb....................', '......bb...........f........', '......bb.......fffffffff....', '......bb......fffffffffff...', '.....bbbb.....fffffffffff...', '....bbbbbb.....fffffffffg...', '....bdbbbb.....gyyyfyyffg...', '....bdbbbb.....gyyyyyyffg...', '....wdwwww.....gyyyyyyffg...', '....wdwwww.....gyyyyyyfyg...', '....rdrrrr.....gyfyyyyyyg...', '....wdwwww.....gyyyyyyyyg...', '....wdwwww.....gyyyyyyyyg...', '....bdbbbb.....gyyyyfyyyg...', '....bdbbbb.....gyyyyyyyyg...', '....bdbbbb.....gyyfyyyyyg...', '....bdbbbb.....gyyyyyyyyg...', '....bbbbbb.....gggggggggg...'],
  phones: ['............................', '...kkkkkkkkkk...............', '...kkkkkkkkkk.........n.....', '...kcccccccck..........n....', '...kcccccccck.......n..nn...', '...kcwwwwwwck.......nn..n...', '...kcccccccck.....n..nn..n..', '...kcwwwwccck.....nn..n..n..', '...kcccccccck......n..n..n..', '...kcwwwwwcck......n..n.....', '...kcccccccck......n..n..n..', '...kcwwwcccck.....nn..n..n..', '...kcccccccck.....n..nn..n..', '...kcccccccck.......nn..n...', '...kcccccccck.......n..nn...', '...kkkkkkkkkk..........n....', '...kkkkGGkkkk.........n.....', '...kkkkkkkkkk...............', '...kkkkkkkkkk...............', '............................'],
  boutique: ['.............GG.............', '..............G.............', '........GGGGGGGGGGGG........', '..........vv....vv..........', '..........vv....vv..........', '..........vvvvvvvv..........', '..........vvoyvoyv..........', '..........vvvvvvvv..........', '..........vvvvvvvv..........', '..........oooooooo..........', '..........vvvvvvvv..........', '.........vvvvvvvvv..........', '........vvvoyvvvoyv.........', '.......vvvvvvvvvvvvv........', '......vvvvvvvvvvvvvvv.......', '.....vvvoyvvvoyvvvvoyv......', '....vvvvvvvvvvvvvvvvvvv.....', '...vvvvvvvvvvvvvvvvvvvvv....', '..vvvvoyvvvoyvvvoyvvvoyvv...', '.vvvvvvvvvvvvvvvvvvvvvvvvv..'],
  shoes: ['............................', '..................gggggggg..', '..................GGGGGGGG..', '..................GGGGGGGG..', '..................GGGGGGGG..', '.....................bb.....', '.....................bb.....', '.......bbbb..........bb.....', '......bbbbbb.........bb.....', '.....bbbbbbbb........bb.....', '....bbbbbbbbbb.......bb.....', '....bbbbbbbbbb.......bb.....', '....bbbbbbbwbw.w............', '....bbbbbbbbwbwbwbbbbbbb....', '....bbbbbbbbbbbbbbbbbbbbb...', '....bbbbbbbbbbbbbbbbbbbbb...', '.....bbbbbbbbbbbbbbbbbbb....', '....kkkkkkkkkkkkkkkkkkkkkk..', '....kkkkkkkkkkkkkkkkkkkkkk..', '....kkkkk...................'],
};
export const MURAL_CANVAS = { width: 30, height: 22 }; // with the outline

/** The wall picture of a shop kind: 30 × 22 with a 1 px dark outline. */
export function drawMural(kind) {
  const c = new PixelCanvas(MURAL_CANVAS.width, MURAL_CANVAS.height);
  (MURALS[kind] ?? []).forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && MURAL_PAL[ch] !== undefined && c.setPixel(1 + x, 1 + y, MURAL_PAL[ch])));
  c.outline(0x161616);
  return c;
}

/**
 * A small iron-sheet porch roof on two poles (Alp's design canvas), along a wall of lenMetres. face:
 * 'south' or 'east'. The canvas origin (groundX, groundY) is where the porch meets the wall at the start
 * of the wall (x0 on a south face, y0 on an east face). poleLevels: the height of the porch.
 */
export function drawPorch(face, lenMetres, poleLevels, rust = false) {
  const d = SHOPS.porchDepthMetres, dropPx = Math.round(SHOPS.porchDropMetres * 10.67);
  const along = face === 'south' ? { x: 8, y: 4 } : { x: -8, y: 4 }; // screen pixels per metre
  const out = face === 'south' ? { x: -8, y: 4 } : { x: 8, y: 4 };
  const A = { x: 0, y: 0 }, B = { x: along.x * lenMetres, y: along.y * lenMetres };
  const D = { x: out.x * d, y: out.y * d + dropPx }, C = { x: B.x + D.x, y: B.y + D.y };
  const pole = Math.round(poleLevels * 16) - dropPx;
  const xs = [A.x, B.x, C.x, D.x], ys = [A.y, B.y, C.y + pole, D.y + pole];
  const minX = Math.floor(Math.min(...xs)) - 1, minY = Math.floor(Math.min(...ys)) - 1;
  const c = new PixelCanvas(Math.ceil(Math.max(...xs)) - minX + 2, Math.ceil(Math.max(...ys)) - minY + 2, minX, minY);
  const light = rust ? 0x9a5a3a : 0xa8aeb6, dark = rust ? 0x7a4a2a : 0x7a8088;
  const P = (p, u, v) => ({ x: p.x, y: p.y, u, v });
  c.fillQuad(P(A, 0, 0), P(B, lenMetres, 0), P(C, lenMetres, d), P(D, 0, d), (u, v) => (v > d - 0.15 ? 0x4a4f55 : Math.floor(u * 4) % 2 ? dark : light));
  // The two poles at the front corners, down to the ground.
  for (const p of [C, D]) {
    const px = Math.round(p.x - minX) + (p === C ? (face === 'south' ? -2 : 1) : (face === 'south' ? 1 : -2));
    for (let y = Math.round(p.y - minY); y < Math.round(p.y - minY) + pole; y++) {
      c.setPixel(px, y, 0x5a6068);
      c.setPixel(px + 1, y, 0x3a3e44);
    }
  }
  return { canvas: c, groundX: -minX, groundY: -minY };
}

/**
 * The sign as it hangs on the shop (design review): 'wall' = painted on the band above the shop front,
 * sheared to follow the wall (2:1, like the iso faces); 'board' = a flat board on two legs in front of
 * the shop, for a wall that is too short for the name. Returns { canvas, groundX, groundY, mount }.
 * groundX, groundY: the point of the canvas that goes at the sign anchor (wall: the bottom of the band
 * in the middle of the sign; board: the ground between the legs).
 */
export function shopSignArt(shop) {
  const sign = drawShopSign(shop.kind, shop.name);
  const src = sign.canvas, w = src.width, h = src.height;
  const wallPx = shop.wallTiles * (WORLD.tileMetres * 8); // a tile face is 32 screen pixels wide
  if (w <= wallPx - SHOPS.wallMarginPx) return { ...shearOnWall(src, shop.sign.face), mount: 'wall' };
  // A board on two dark legs, parallel to the shop wall (Alp, 14 October 2026); the legs reach the ground.
  const face = shop.sign.face;
  const shift = (x) => (face === 'south' ? Math.floor(x / 2) : Math.floor((w - 1 - x) / 2));
  const legs = Math.round(SHOPS.boardLevel * 16);
  const board = shearOnWall(src, face).canvas;
  const c = new PixelCanvas(w, board.height + legs);
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (board.data[i + 3]) c.setPixel(x, y, (board.data[i] << 16) | (board.data[i + 1] << 8) | board.data[i + 2], board.data[i + 3]);
    }
  }
  for (const lx of [3, w - 5]) {
    for (let y = h - 1; y < h + legs; y++) {
      c.setPixel(lx, y + shift(lx), 0x3a3430);
      c.setPixel(lx + 1, y + shift(lx + 1), 0x24201c);
    }
    c.setPixel(lx - 1, h + legs - 1 + shift(lx - 1), 0x000000, 80); // a small shadow at the foot
    c.setPixel(lx + 2, h + legs - 1 + shift(lx + 2), 0x000000, 80);
  }
  const mid = Math.floor(w / 2);
  return { canvas: c, groundX: mid, groundY: h + legs - 1 + shift(mid), mount: 'board' };
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
    const g = groups.get(b.groupId) ?? { id: b.groupId, x0: b.tx, x1: b.tx, y0: b.ty, y1: b.ty, top: 0, roof: Infinity, district: t.district };
    g.roof = Math.min(g.roof, b.topLevel); // the lowest roof of the shop (a wall picture must fit under it)
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
    // The run of free tiles in front of the face, from the first one (the sign stands in its middle).
    let run = 1;
    if (face === 'south') while (midX + run <= g.x1 && free(midX + run, g.y1 + 1)) run++;
    else while (midY + run <= g.y1 && free(g.x1 + 1, midY + run)) run++;
    const wallTiles = face === 'south' ? g.x1 - g.x0 + 1 : g.y1 - g.y0 + 1;
    // The wall picture goes on the other visible wall (the side of the shop), when no building hides it.
    const sideFace = face === 'south' ? 'east' : 'south';
    const sideTiles = sideFace === 'east' ? g.y1 - g.y0 + 1 : g.x1 - g.x0 + 1;
    let sideOpen = true;
    for (let i = 0; i < sideTiles; i++) {
      const n = sideFace === 'east' ? world.blockAt(g.x1 + 1, g.y0 + i) : world.blockAt(g.x0 + i, g.y1 + 1);
      if (n && n.kind === 'building') sideOpen = false;
    }
    const fits = (g.roof - g.top) * 16 >= SHOPS.muralLevel * 16 + MURAL_CANVAS.height; // 16 screen pixels a level
    const muralFace = sideOpen && fits ? sideFace : null;
    const muralMid = sideFace === 'east' ? { x: (g.x1 + 1) * T, y: ((g.y0 + g.y1 + 1) / 2) * T } : { x: ((g.x0 + g.x1 + 1) / 2) * T, y: (g.y1 + 1) * T };
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
    // The sign: in the middle of the free run (the middle of the wall when the sign is painted on it,
    // see shopSignArt; SignView places it).
    const sign = face === 'south' ? { x: (midX + run / 2) * T, y: (g.y1 + 1) * T, face } : { x: (g.x1 + 1) * T, y: (midY + run / 2) * T, face };
    const wallMid = face === 'south' ? { x: ((g.x0 + g.x1 + 1) / 2) * T, y: (g.y1 + 1) * T } : { x: (g.x1 + 1) * T, y: ((g.y0 + g.y1 + 1) / 2) * T };
    const front = face === 'south' ? { x: midX + 0.5, y: g.y1 + 1.5 } : { x: g.x1 + 1.5, y: midY + 0.5 };
    out.push({ id: `shop-${g.x0}-${g.y0}`, kind, name, groupId: g.id, sign, wallMid, wallTiles, muralFace, muralMid, floor: g.top, stand, front, district: g.district, x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 });
  }
  return out;
}

/** Job places for some of the shops (tags: 'shop', and 'buffet' for a buffet: a food stop in medium and hard modes). */
export function shopPlaces(shops) {
  return shops
    .filter((s, i) => s.stand && (s.kind === 'buffet' || i % SHOPS.placeEvery === 0))
    .map((s) => ({
      id: s.id, name: s.name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' '),
      x: s.stand.x, y: s.stand.y, tags: s.kind === 'buffet' ? ['shop', 'buffet'] : ['shop'], weight: 1, district: s.district,
    }));
}
