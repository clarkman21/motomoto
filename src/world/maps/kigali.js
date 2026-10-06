import { LIGHTS, DISTRICTS } from '../../config.js';

// The Kigali map: 6 districts of 64 × 64 tiles (256 m × 256 m each), built in code.
// The result has the same shape as TEST_MAP (rows, hills, places, zones, cameras, signs)
// plus `roads` (the road network for traffic), `busStops`, `lamps`, `districts` and `crowdAreas`.
//
// Kigali is hills with valleys between them. The layout follows the real city, compressed:
//
//            x 0-63              x 64-127             x 128-191
//   y 0-63   Nyabugogo (valley)  Kacyiru (hill)       Nyarutarama (two ridges, golf valley)
//   y 64-127 Kigali town (ridge) Kimihurura (hill)    Kicukiro (plateau)
//
// x goes right and down on the screen, y goes left and down. Heights are in levels (1.5 m).
// Roads: horizontal { y, x0, x1 } uses rows y and y+1; vertical { x, y0, y1 } uses columns x and x+1.

export const KIGALI_W = 192;
export const KIGALI_H = 128;

// District rectangles in tiles (x1, y1 exclusive). Names and unlock levels are in config.js (DISTRICTS).
const DISTRICT_RECTS = {
  nyabugogo: { x0: 0, y0: 0, x1: 64, y1: 64 },
  town: { x0: 0, y0: 64, x1: 64, y1: 128 },
  kacyiru: { x0: 64, y0: 0, x1: 128, y1: 64 },
  kimihurura: { x0: 64, y0: 64, x1: 128, y1: 128 },
  nyarutarama: { x0: 128, y0: 0, x1: 192, y1: 64 },
  kicukiro: { x0: 128, y0: 64, x1: 192, y1: 128 },
};

// What each district looks like (for the spec and the code reader).
export const DISTRICT_LOOKS = {
  nyabugogo: 'Valley floor beside the river. The big bus park, the market, Gakinjiro workshops. Kimisagara hillside with steep murram lanes in the west; the Muhima road climbs south to town.',
  town: 'Kigali town on the Nyarugenge ridge (level 7). Tall buildings, the central roundabout, Kigali City Tower, the car free zone, the town market.',
  kacyiru: 'Kacyiru hill (level 6). Government offices with lawns, the police headquarters, the hospital, a wide boulevard with trees.',
  kimihurura: 'Kimihurura hill (level 6). The Convention Centre dome at the big roundabout, Parliament, villas on cobblestone lanes. Rugando wetland valley to the west.',
  nyarutarama: 'Two ridges with the golf course and a lake in the valley between them. Big villas, quiet cobblestone streets, the MTN Centre.',
  kicukiro: 'A wide plateau (level 4). Sonatubes junction, the busy Kicukiro centre market, murram side streets, Gikondo warehouses and trucks.',
};

const RUN1 = { west: 1, east: 1, north: 1, south: 1 };
const HILLS = [
  { name: 'Kimisagara hillside', x0: 0, y0: 26, x1: 6, y1: 60, level: 5, run: { west: 1, east: 2.4, north: 2, south: 2 } },
  { name: 'Nyarugenge ridge (Kigali town)', x0: 0, y0: 78, x1: 50, y1: 128, level: 7, run: { west: 1, east: 2, north: 3.5, south: 1 } },
  { name: 'Kacyiru hill', x0: 76, y0: 0, x1: 120, y1: 54, level: 6, run: { west: 2, east: 2, north: 1, south: 2 } },
  { name: 'Kacyiru–Kimihurura saddle', x0: 80, y0: 54, x1: 118, y1: 72, level: 3, run: RUN1 },
  { name: 'Kimihurura hill', x0: 76, y0: 72, x1: 120, y1: 128, level: 6, run: { west: 2, east: 2, north: 2, south: 1 } },
  { name: 'Kacyiru–Nyarutarama saddle', x0: 118, y0: 0, x1: 136, y1: 26, level: 4, run: RUN1 },
  { name: 'Nyarutarama north ridge', x0: 134, y0: 0, x1: 192, y1: 22, level: 6, run: { west: 2, east: 1, north: 1, south: 2 } },
  { name: 'Nyarutarama south ridge', x0: 134, y0: 42, x1: 192, y1: 56, level: 5, run: { west: 2, east: 1, north: 2, south: 2 } },
  { name: 'Kimihurura–Kicukiro saddle', x0: 118, y0: 86, x1: 136, y1: 106, level: 3, run: RUN1 },
  { name: 'Kicukiro plateau', x0: 134, y0: 72, x1: 192, y1: 128, level: 4, run: { west: 2, east: 1, north: 2, south: 1 } },
];

// Roundabouts: a ring of 4 roads around a centre island. (cx, cy): the crossing of the two roads.
function ringRoads(name, cx, cy, surface = '#') {
  return [
    { name, y: cy - 5, x0: cx - 5, x1: cx + 6, surface },
    { name, y: cy + 5, x0: cx - 5, x1: cx + 6, surface },
    { name, x: cx - 5, y0: cy - 5, y1: cy + 6, surface },
    { name, x: cx + 5, y0: cy - 5, y1: cy + 6, surface },
  ];
}
const TOWN_RING = { cx: 26, cy: 96 };
const KCC_RING = { cx: 100, cy: 96 };

const ROADS = [
  // Arterials across the whole map
  { name: 'Northern road (Nyabugogo to Nyarutarama)', y: 20, x0: 0, x1: 191, surface: '#' },
  { name: 'Southern road (town to Kicukiro)', y: 96, x0: 0, x1: TOWN_RING.cx - 5, surface: '#' },
  { name: 'Southern road (town to Kicukiro)', y: 96, x0: TOWN_RING.cx + 6, x1: KCC_RING.cx - 5, surface: '#' },
  { name: 'Southern road (town to Kicukiro)', y: 96, x0: KCC_RING.cx + 6, x1: 191, surface: '#' },
  { name: 'Muhima road', x: 40, y0: 5, y1: 127, surface: '#' },
  { name: 'Kacyiru–Kimihurura road', x: 100, y0: 0, y1: KCC_RING.cy - 5, surface: '#' },
  { name: 'Kacyiru–Kimihurura road', x: 100, y0: KCC_RING.cy + 6, y1: 127, surface: '#' },
  { name: 'Remera road', x: 160, y0: 0, y1: 127, surface: '#' },
  // Nyabugogo
  { name: 'River road', y: 5, x0: 0, x1: 63, surface: '#' },
  { name: 'Gakinjiro road', x: 18, y0: 5, y1: 63, surface: '#' },
  { name: 'Bus park lane', y: 12, x0: 18, x1: 40, surface: '#' },
  { name: 'Gakinjiro murram', y: 32, x0: 18, x1: 63, surface: 'm' },
  { name: 'Valley road', y: 44, x0: 18, x1: 63, surface: '#' },
  { name: 'Kimisagara lane', y: 38, x0: 0, x1: 18, surface: 'm' },
  { name: 'Kimisagara steep lane', x: 4, y0: 24, y1: 62, surface: 'm' },
  { name: 'Kimisagara cobble', y: 54, x0: 4, x1: 40, surface: 'c' },
  { name: 'Kinamba road', x: 61, y0: 20, y1: 63, surface: '#' },
  // Kigali town
  ...ringRoads('Town roundabout', TOWN_RING.cx, TOWN_RING.cy),
  { name: 'Town avenue', x: TOWN_RING.cx, y0: 78, y1: TOWN_RING.cy - 5, surface: '#' },
  { name: 'Town avenue', x: TOWN_RING.cx, y0: TOWN_RING.cy + 6, y1: 127, surface: '#' },
  { name: 'Nyamirambo road', x: 10, y0: 64, y1: 127, surface: '#' },
  { name: 'Town north street', y: 84, x0: 0, x1: 50, surface: '#' },
  { name: 'Town south street', y: 110, x0: 0, x1: 50, surface: '#' },
  { name: 'Kiyovu cobble', y: 120, x0: 10, x1: 63, surface: 'c' },
  { name: 'Rugando valley murram', x: 61, y0: 64, y1: 127, surface: 'm' },
  // Kacyiru
  { name: 'Kacyiru boulevard', y: 36, x0: 64, x1: 127, surface: '#' },
  { name: 'Kacyiru street', x: 84, y0: 0, y1: 54, surface: '#' },
  { name: 'Embassy lane', y: 48, x0: 84, x1: 120, surface: 'c' },
  // Kimihurura
  ...ringRoads('Kimihurura roundabout', KCC_RING.cx, KCC_RING.cy),
  { name: 'Kimihurura upper lane', y: 80, x0: 64, x1: 127, surface: 'c' },
  { name: 'Kimihurura lower lane', y: 114, x0: 64, x1: 127, surface: 'c' },
  { name: 'Kimihurura west lane', x: 86, y0: 72, y1: 127, surface: 'c' },
  { name: 'Kimihurura east lane', x: 114, y0: 72, y1: 127, surface: 'c' },
  // Nyarutarama
  { name: 'Nyarutarama cobble', y: 48, x0: 128, x1: 191, surface: 'c' },
  { name: 'Nyarutarama east street', x: 176, y0: 0, y1: 63, surface: 'c' },
  { name: 'Golf murram track', x: 142, y0: 20, y1: 48, surface: 'm' },
  // Kicukiro
  { name: 'Kicukiro north murram', y: 84, x0: 128, x1: 191, surface: 'm' },
  { name: 'Kicukiro south murram', y: 116, x0: 128, x1: 191, surface: 'm' },
  { name: 'Gikondo murram', x: 144, y0: 64, y1: 127, surface: 'm' },
  { name: 'Kicukiro avenue', x: 178, y0: 64, y1: 127, surface: '#' },
  { name: 'Kicukiro centre street', y: 106, x0: 160, x1: 191, surface: '#' },
];

// Open areas where many people walk (and wait for motos).
const CROWD_AREAS = [
  { name: 'Nyabugogo bus park', x0: 22, y0: 7, x1: 37, y1: 18 },
  { name: 'Nyabugogo market', x0: 44, y0: 7, x1: 60, y1: 18 },
  { name: 'Car free zone', x0: 34, y0: 102, x1: 49, y1: 109 },
  { name: 'Kicukiro centre market', x0: 164, y0: 99, x1: 177, y1: 105 },
];

export function buildKigaliMap(seed = 7) {
  const W = KIGALI_W, H = KIGALI_H;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const reserved = Array.from({ length: H }, () => Array(W).fill(false)); // no buildings or trees here
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, c) => inside(x, y) && (g[y][x] = c);
  const get = (x, y) => (inside(x, y) ? g[y][x] : null);
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) reserved[y][x] = true; };
  const isRoad = (c) => c === '#' || c === 'm' || c === 'c' || c === 'o' || c === '=' || c === 'w';
  const nearRoad = (x, y, r = 1) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((dx || dy) && isRoad(get(x + dx, y + dy))) return true;
    return false;
  };
  const hash = (x, y, k = 0) => {
    let h = (x * 374761393 + y * 668265263 + (seed + k) * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const districtOf = (x, y) => Object.keys(DISTRICT_RECTS).find((id) => {
    const r = DISTRICT_RECTS[id];
    return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
  });
  // Ground level at a tile centre (the max of the hills), to keep the valleys green.
  const levelAt = (x, y) => Math.max(0, ...HILLS.map((h) => hillLevel(h, x + 0.5, y + 0.5)));

  // Water: the Nyabugogo river along the north edge, and the lake in the Nyarutarama golf valley.
  rect(0, 0, 63, 2, 'r');
  rect(144, 31, 156, 34, 'r');
  rect(147, 30, 153, 35, 'r');

  // Lots before roads, so roads cut through them.
  rect(22, 7, 36, 17, '#'); // Nyabugogo bus park
  rect(44, 7, 60, 17, 'm'); // Nyabugogo market ground
  for (let y = 8; y <= 16; y += 3) for (let x = 45; x <= 59; x++) if (x % 5 !== 1) set(x, y, '2'); // market stalls
  rect(164, 99, 176, 104, 'm'); // Kicukiro centre market
  for (let x = 165; x <= 175; x += 2) set(x, 101, '2');
  rect(34, 102, 48, 108, 'p'); // the car free zone (pavement, people only)
  for (const a of CROWD_AREAS) reserve(a.x0, a.y0, a.x1, a.y1);
  reserve(130, 24, 191, 41); // the golf course: grass, sand and trees, no buildings

  // Marsh tracks (wet murram) on the river bank and in the wetland valleys.
  for (let x = 0; x < 64; x++) if (hash(x, 3, 11) < 0.35) set(x, 3, 'w');

  // Roads.
  for (const r of ROADS) {
    if (r.y !== undefined) rect(r.x0, r.y, r.x1, r.y + 1, r.surface);
    else rect(r.x, r.y0, r.x + 1, r.y1, r.surface);
  }

  // Roundabout islands: the town monument, and a garden at the Kimihurura roundabout.
  for (const [ring, centre] of [[TOWN_RING, 'M'], [KCC_RING, 't']]) {
    const { cx, cy } = ring;
    rect(cx - 3, cy - 3, cx + 4, cy + 4, '.');
    reserve(cx - 3, cy - 3, cx + 4, cy + 4);
    if (centre === 'M') rect(cx, cy, cx + 1, cy + 1, 'M');
    else for (const [dx, dy] of [[-2, -2], [3, -2], [-2, 3], [3, 3]]) set(cx + dx, cy + dy, 't');
  }

  // Stations and garages (2 tiles each, beside a road). facing: the side of the road.
  const places = [];
  const station = (x, y, c, facing, name) => {
    set(x, y, c);
    set(x + 1, y, c);
    reserve(x - 1, y - 1, x + 2, y + 1);
    const tag = { F: 'fuel', S: 'swap', G: 'garage' }[c];
    const p = { north: { x: x + 1, y: y - 0.6 }, south: { x: x + 1, y: y + 1.6 }, west: { x: x - 0.6, y: y + 0.5 }, east: { x: x + 2.6, y: y + 0.5 } }[facing];
    places.push({ id: `${tag}-${x}-${y}`, name, ...p, tags: [tag] });
  };
  station(46, 22, 'F', 'north', 'Nyabugogo fuel');
  station(20, 40, 'F', 'west', 'Gakinjiro fuel');
  station(38, 14, 'S', 'east', 'Ampersand swap, Nyabugogo');
  station(20, 24, 'G', 'west', 'Gakinjiro garage');
  station(12, 98, 'F', 'north', 'Town fuel');
  station(34, 98, 'S', 'north', 'Ampersand swap, town');
  station(102, 30, 'S', 'west', 'Ampersand swap, Kacyiru');
  station(86, 38, 'F', 'west', 'Kacyiru fuel');
  station(88, 98, 'F', 'north', 'Kimihurura fuel');
  station(162, 22, 'S', 'north', 'Ampersand swap, Nyarutarama');
  station(178, 22, 'F', 'north', 'Nyarutarama fuel');
  station(162, 98, 'F', 'north', 'Sonatubes fuel');
  station(146, 86, 'F', 'north', 'Gikondo fuel');
  station(180, 98, 'S', 'north', 'Ampersand swap, Kicukiro');
  station(180, 108, 'G', 'north', 'Kicukiro garage');

  // Landmark buildings.
  const landmark = (x0, y0, x1, y1, c) => { rect(x0, y0, x1, y1, c); reserve(x0 - 1, y0 - 1, x1 + 1, y1 + 1); };
  landmark(34, 86, 36, 88, '9'); // Kigali City Tower
  landmark(14, 100, 18, 104, '3'); // Kigali town market
  landmark(104, 6, 111, 12, '4'); // King Faisal Hospital
  landmark(88, 24, 95, 30, '4'); // Police headquarters
  landmark(89, 104, 94, 109, '4'); // Parliament
  landmark(140, 8, 143, 12, '7'); // MTN Centre
  landmark(136, 27, 139, 29, '2'); // golf club house
  landmark(107, 83, 112, 88, 'K'); // Kigali Convention Centre (dome)

  // Pavement beside busy tarmac roads (people walk here).
  const paved = (x, y) => {
    const d = districtOf(x, y);
    if (d === 'town') return levelAt(x, y) > 5;
    if (d === 'nyabugogo') return y <= 24 && x >= 6;
    if (d === 'kacyiru') return y >= 34 && y <= 39; // the boulevard
    if (d === 'kicukiro') return x >= 158 && y >= 94 && y <= 108;
    return false;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.' || reserved[y][x] || !paved(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === '#')) set(x, y, 'p');
  }

  // Buildings: each district has its own style. Valleys outside Nyabugogo stay green (wetland gardens).
  const free = (x, y) => g[y][x] === '.' && !reserved[y][x];
  const lot = (x, y, s, k) => hash(Math.floor(x / s), Math.floor(y / s), k);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!free(x, y)) continue;
    const d = districtOf(x, y);
    const lvl = levelAt(x, y);
    if (d !== 'nyabugogo' && lvl < 1) continue;
    let c = null;
    if (d === 'nyabugogo') {
      if (x < 17 && y > 22) { // Kimisagara: small houses close together
        if (!nearRoad(x, y) && hash(x, y, 1) < 0.55) c = '2';
      } else if (nearRoad(x, y, 2)) { // shops and workshops along the roads
        if (!nearRoad(x, y) && lot(x, y, 2, 2) < 0.6) c = String(2 + Math.floor(lot(x, y, 2, 3) * 3));
      } else if (lot(x, y, 2, 4) < 0.35) c = '2';
    } else if (d === 'town') {
      if (lvl < 5) { // Muhima hillside: houses
        if (!nearRoad(x, y) && hash(x >> 1, y >> 1, 5) < 0.5) c = String(2 + Math.floor(hash(x >> 1, y >> 1, 6) * 2));
      } else if (lot(x, y, 3, 7) > 0.12) c = String(4 + Math.floor(lot(x, y, 3, 8) * 6)); // city blocks, a few plazas
    } else if (d === 'kacyiru') {
      if (!nearRoad(x, y) && lot(x, y, 4, 9) < 0.5) c = String(3 + Math.floor(lot(x, y, 4, 10) * 3)); // offices with lawns
    } else if (d === 'kimihurura' || d === 'nyarutarama') {
      if (!nearRoad(x, y) && lot(x, y, d === 'kimihurura' ? 2 : 3, 11) < 0.38) c = String(2 + Math.floor(lot(x, y, 3, 12) * 2)); // villas
    } else if (d === 'kicukiro') {
      if (x < 144 && y >= 100) { // Gikondo warehouses: long and low
        if (!nearRoad(x, y) && hash(x >> 2, y >> 1, 13) < 0.7) c = '2';
      } else if (!nearRoad(x, y) && lot(x, y, 2, 14) < 0.5) c = String(2 + Math.floor(lot(x, y, 2, 15) * 2));
    }
    if (c) set(x, y, c);
  }

  // Trees: avenue trees on the Kacyiru boulevard, many trees in the rich districts and the golf course.
  for (let x = 66; x < 126; x += 3) for (const y of [35, 38]) if (g[y][x] === '.' || g[y][x] === 'p') set(x, y, 't');
  const treeChance = { nyabugogo: 0.04, town: 0.05, kacyiru: 0.1, kimihurura: 0.12, nyarutarama: 0.12, kicukiro: 0.05 };
  for (let y = 4; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    if (g[y][x] !== '.' || (reserved[y][x] && !(y >= 24 && y <= 41 && x >= 130))) continue;
    const golf = y >= 24 && y <= 41 && x >= 130;
    if (hash(x, y, 16) < (golf ? 0.06 : treeChance[districtOf(x, y)])) set(x, y, 't');
    else if (golf && hash(x >> 1, y >> 1, 17) < 0.06) set(x, y, 's'); // sand bunkers
  }

  // Potholes on the valley and Kicukiro tarmac (the hills have good roads); speed bumps near markets.
  const isJunction = (x, y) => isRoad(get(x + 2, y)) && isRoad(get(x, y + 2)) && isRoad(get(x - 2, y)) && isRoad(get(x, y - 2));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = districtOf(x, y);
    if (g[y][x] === '#' && (d === 'nyabugogo' || d === 'kicukiro') && !isJunction(x, y) && hash(x, y, 18) < 0.012) set(x, y, 'o');
  }
  const bumpAcross = (x, y, horiz) => { set(x, y, '='); horiz ? set(x, y + 1, '=') : set(x + 1, y, '='); };
  for (const x of [26, 34]) bumpAcross(x, 20, true);
  bumpAcross(18, 14, false);
  bumpAcross(40, 9, false);
  for (const x of [166, 174]) bumpAcross(x, 96, true);
  bumpAcross(178, 100, false);
  bumpAcross(10, 90, false);

  // Street lamps beside the tarmac roads, on alternate sides. Murram and cobble lanes stay dark.
  // side: the side of the road the lamp stands on. The lamp arm points over the road.
  const lamps = [];
  const lampFree = (c) => c === '.' || c === 'p';
  const step = LIGHTS.lampSpacingTiles;
  for (const r of ROADS) {
    if (r.surface !== '#') continue;
    if (r.y !== undefined) {
      for (let x = r.x0 + 2, i = 0; x <= r.x1 - 2; x += step, i++) {
        const north = i % 2 === 0;
        const ty = north ? r.y - 1 : r.y + 2;
        if (lampFree(get(x, ty))) lamps.push({ x: x + 0.5, y: north ? r.y - 0.3 : r.y + 2.3, side: north ? 'north' : 'south' });
      }
    } else {
      for (let y = r.y0 + 2, i = 0; y <= r.y1 - 2; y += step, i++) {
        const west = i % 2 === 0;
        const tx = west ? r.x - 1 : r.x + 2;
        if (lampFree(get(tx, y))) lamps.push({ x: west ? r.x - 0.3 : r.x + 2.3, y: y + 0.5, side: west ? 'west' : 'east' });
      }
    }
  }

  // Lamps over the bus park and the markets too: Nyabugogo is busy all night.
  for (const a of CROWD_AREAS) {
    for (let y = a.y0 + 2; y < a.y1 - 1; y += 5) for (let x = a.x0 + 2; x < a.x1 - 1; x += 5) {
      if (!isRoad(get(x, y)) && get(x, y) !== 'p') continue;
      if (isRoad(get(x, y)) && [[0, 1], [1, 0]].some(([dx, dy]) => get(x + dx, y + dy) >= '1' && get(x + dx, y + dy) <= '9')) continue;
      lamps.push({ x: x + 0.5, y: y + 0.5, side: 'north' });
    }
  }

  const rows = g.map((r) => r.join(''));

  // Job places. weight: how often jobs start here (the bus park makes many fares).
  const P = (id, name, x, y, tags = [], weight = 1) => places.push({ id, name, x, y, tags, weight });
  P('busPark', 'Nyabugogo bus park', 29, 15, ['market'], 5);
  P('market', 'Nyabugogo market', 52, 13.5, ['market'], 3);
  P('riverRoad', 'River road', 12, 6, []);
  P('gakinjiro', 'Gakinjiro workshops', 30, 33, ['market']);
  P('kimisagara', 'Kimisagara hillside', 5, 40, [], 1);
  P('kimisagaraLane', 'Kimisagara lane', 12, 39, []);
  P('muhimaFoot', 'Valley road', 50, 45, []);
  P('kinamba', 'Kinamba', 62, 30, []);
  P('muhima', 'Muhima hill', 41, 62, []);
  P('townRoundabout', 'Town roundabout', 26, 90, [], 2);
  P('cityTower', 'Kigali City Tower', 37.5, 89, [], 2);
  P('townMarket', 'Kigali town market', 13, 104, ['market'], 2);
  P('carFree', 'Car free zone', 41, 105, [], 1);
  P('kiyovu', 'Kiyovu', 30, 121, []);
  P('nyamirambo', 'Nyamirambo road', 11, 74, []);
  P('hospital', 'King Faisal Hospital', 102.5, 10, [], 2);
  P('policeHq', 'Police headquarters', 86.5, 28, []);
  P('kacyiruBoulevard', 'Kacyiru boulevard', 110, 37, []);
  P('embassies', 'Embassy lane', 100, 49, []);
  P('kcc', 'Kigali Convention Centre', 114.5, 86, [], 2);
  P('parliament', 'Parliament', 87, 106, []);
  P('kimihururaVillas', 'Kimihurura villas', 114.5, 108, []);
  P('rugando', 'Rugando valley', 62, 100, []);
  P('mtn', 'MTN Centre', 144.5, 13, [], 2);
  P('golf', 'Golf club', 143, 28, []);
  P('nyarutaramaVillas', 'Nyarutarama villas', 168, 49, []);
  P('nyarutaramaEast', 'Nyarutarama east street', 177, 8, []);
  P('sonatubes', 'Sonatubes junction', 158, 98.5, [], 2);
  P('kicukiroCentre', 'Kicukiro centre market', 170, 104, ['market'], 3);
  P('gikondo', 'Gikondo warehouses', 145, 110, ['market'], 2);
  P('kicukiroSouth', 'Kicukiro south', 168, 117, []);
  P('airportRoad', 'Airport road', 189, 97, []);
  for (const p of places) p.district = districtOf(Math.floor(p.x), Math.floor(p.y));

  return {
    name: 'Kigali',
    start: { x: 30, y: 21, headingDeg: 0 },
    rows,
    hills: HILLS,
    roads: ROADS,
    lamps,
    crowdAreas: CROWD_AREAS,
    districts: Object.entries(DISTRICT_RECTS).map(([id, r]) => ({ id, name: DISTRICTS[id]?.name ?? id, ...r, look: DISTRICT_LOOKS[id] })),
    places,
    zones: [
      { name: 'Bus park and market', x0: 6, y0: 4, x1: 63, y1: 19, limitKmh: 30 },
      { name: 'Kimisagara', x0: 0, y0: 22, x1: 17, y1: 63, limitKmh: 30 },
      { name: 'Kigali town', x0: 0, y0: 76, x1: 50, y1: 127, limitKmh: 40 },
      { name: 'Kacyiru', x0: 76, y0: 0, x1: 120, y1: 54, limitKmh: 50 },
      { name: 'Kimihurura', x0: 76, y0: 72, x1: 127, y1: 127, limitKmh: 30 },
      { name: 'Nyarutarama', x0: 128, y0: 0, x1: 191, y1: 63, limitKmh: 30 },
      { name: 'Kicukiro centre', x0: 156, y0: 92, x1: 191, y1: 112, limitKmh: 30 },
    ],
    cameras: [
      { x: 14, y: 22.3 }, // northern road, Nyabugogo (30)
      { x: 70, y: 22.3 }, // northern road, the climb to Kacyiru (60)
      { x: 42.2, y: 66 }, // Muhima road (60)
      { x: 70, y: 98.3 }, // southern road, Rugando valley (60)
      { x: 130, y: 98.3 }, // southern road, the saddle to Kicukiro (60)
      { x: 162.2, y: 66 }, // Remera road (60)
    ],
    signs: [
      { x: 5.6, y: 22.4, limitKmh: 30 },
      { x: 62.4, y: 18.6, limitKmh: 30 },
      { x: 39.6, y: 76.6, limitKmh: 40 },
      { x: 75.6, y: 18.6, limitKmh: 50 },
      { x: 75.6, y: 98.4, limitKmh: 30 },
      { x: 127.6, y: 22.4, limitKmh: 30 },
      { x: 155.6, y: 98.4, limitKmh: 30 },
    ],
    busStops: [
      { x: 29, y: 12, side: 'north', park: true }, // Nyabugogo bus park
      { x: 52, y: 22, side: 'south' },
      { x: 90, y: 20, side: 'north' },
      { x: 150, y: 22, side: 'south' },
      { x: 8, y: 98, side: 'south' },
      { x: 76, y: 96, side: 'north' },
      { x: 140, y: 98, side: 'south' },
      { x: 186, y: 96, side: 'north' },
      { x: 40, y: 60, side: 'east' },
      { x: 160, y: 80, side: 'east' },
    ],
  };
}

/** Height in levels that one hill gives at a point (same rule as world.js hillLevelAt). */
function hillLevel(hill, vx, vy) {
  const { x0, y0, x1, y1, level, run } = hill;
  let dx = 0;
  if (vx < x0) dx = (x0 - vx) / run.west;
  else if (vx > x1) dx = (vx - x1) / run.east;
  let dy = 0;
  if (vy < y0) dy = (y0 - vy) / run.north;
  else if (vy > y1) dy = (vy - y1) / run.south;
  return Math.max(0, level - Math.max(dx, dy));
}
