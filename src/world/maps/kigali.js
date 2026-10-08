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
  town: 'Kigali town on the Nyarugenge ridge (level 7). Tall buildings, the MTN roundabout and the big town roundabout, Kigali City Tower, the car free zone, the town market, the hotels. Mount Kigali rises steeply on the west side (forest).',
  kacyiru: 'Kacyiru hill (level 6). Government offices with lawns, the police headquarters, the hospital, the Kacyiru boulevard (a double carriageway with palms, flowers and lamps in the median) that ends at the US Embassy roundabout.',
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
  // Mount Kigali (Alp's terrain map): a high, steep, green ridge on the west side of town. Forest, no houses.
  { name: 'Mount Kigali', x0: 0, y0: 76, x1: 3, y1: 128, level: 12, run: { west: 1, east: 1.3, north: 2, south: 1 } },
];
// The tiles of Mount Kigali that are higher than the town ridge: forest, no buildings or roads.
const onMountKigali = (x, y) => x < 10 && y >= 66;

// Roundabouts: a round, one way ring (see sim/roads.js) around an island. (cx, cy): the tile where
// the two roads cross (the old grid crossing); the ring's centre is the grid point (cx + 1, cy + 1).
// r: the radius of the ring's centre line, in tiles. The roads stop at the ring.
const ring = (name, cx, cy, r, island) => ({ name, ring: true, cx: cx + 1, cy: cy + 1, r, surface: '#', island });
const TOWN_RING = { cx: 26, cy: 96, r: 5 }; // the big town roundabout (grass and flowers) to the car free zone
const KCC_RING = { cx: 100, cy: 96, r: 5 }; // the KCC roundabout (grass and flowers)
const MTN_RING = { cx: 40, cy: 84, r: 4 }; // the MTN roundabout in the financial centre (the yellow fountain)
const EMBASSY_RING = { cx: 120, cy: 36, r: 6 }; // the US Embassy roundabout at the east end of the Kacyiru boulevard
// The Kacyiru boulevard: a double carriageway (Alp): rows y..y+5. Rows y, y+1 and y+4, y+5 are the two
// carriageways (2 lanes each way); rows y+2, y+3 are the median with tall palms, flowers and lamps.
// The centre line of the road (for traffic) is in the median; the lanes are 8 m from it.
const BOULEVARD = { y: 34, x0: 61, x1: EMBASSY_RING.cx - EMBASSY_RING.r };

const ROADS = [
  // Arterials across the whole map
  { name: 'Northern road (Nyabugogo to Nyarutarama)', y: 20, x0: 0, x1: 191, surface: '#' },
  { name: 'Southern road (town to Kicukiro)', y: 96, x0: 10, x1: TOWN_RING.cx - 5, surface: '#' },
  { name: 'Southern road (town to Kicukiro)', y: 96, x0: TOWN_RING.cx + 6, x1: KCC_RING.cx - 5, surface: '#' },
  { name: 'Southern road (town to Kicukiro)', y: 96, x0: KCC_RING.cx + 6, x1: 191, surface: '#' },
  { name: 'Muhima road', x: 40, y0: 5, y1: MTN_RING.cy - MTN_RING.r, surface: '#' },
  { name: 'Muhima road', x: 40, y0: MTN_RING.cy + MTN_RING.r + 1, y1: 127, surface: '#' },
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
  ring('Town roundabout', TOWN_RING.cx, TOWN_RING.cy, TOWN_RING.r, 'garden'),
  ring('MTN roundabout', MTN_RING.cx, MTN_RING.cy, MTN_RING.r, 'fountain'),
  { name: 'Town avenue', x: TOWN_RING.cx, y0: 78, y1: TOWN_RING.cy - 5, surface: '#' },
  { name: 'Town avenue', x: TOWN_RING.cx, y0: TOWN_RING.cy + 6, y1: 127, surface: '#' },
  { name: 'Nyamirambo road', x: 10, y0: 64, y1: 127, surface: '#' },
  { name: 'Town north street', y: 84, x0: 10, x1: MTN_RING.cx - MTN_RING.r, surface: '#' },
  { name: 'Town north street', y: 84, x0: MTN_RING.cx + MTN_RING.r + 1, x1: 50, surface: '#' },
  { name: 'Town south street', y: 110, x0: 10, x1: 50, surface: '#' },
  { name: 'Kiyovu cobble', y: 120, x0: 10, x1: 63, surface: 'c' },
  { name: 'Rugando valley murram', x: 61, y0: 64, y1: 127, surface: 'm' },
  // Kacyiru
  { name: 'Kacyiru boulevard', y: BOULEVARD.y, x0: BOULEVARD.x0, x1: BOULEVARD.x1, surface: '#', width: 6, median: true, laneOffset: 8 },
  ring('US Embassy roundabout', EMBASSY_RING.cx, EMBASSY_RING.cy, EMBASSY_RING.r, 'garden'),
  { name: 'Embassy road north', x: EMBASSY_RING.cx, y0: 20, y1: EMBASSY_RING.cy - EMBASSY_RING.r, surface: '#' },
  { name: 'Embassy road south', x: EMBASSY_RING.cx, y0: EMBASSY_RING.cy + EMBASSY_RING.r + 1, y1: 49, surface: '#' },
  { name: 'Nyarutarama link', y: EMBASSY_RING.cy, x0: EMBASSY_RING.cx + EMBASSY_RING.r + 1, x1: 142, surface: '#' },
  { name: 'Kacyiru street', x: 84, y0: 0, y1: 54, surface: '#' },
  { name: 'Embassy lane', y: 48, x0: 84, x1: EMBASSY_RING.cx, surface: 'c' },
  // Kimihurura
  ring('KCC roundabout', KCC_RING.cx, KCC_RING.cy, KCC_RING.r, 'garden'),
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
  // The building style of each tile (see BUILDING_STYLES in world.js): h house, s shop, o office,
  // t glass tower, g government, c school, w warehouse, v villa, e embassy, H hotel, P palm (a tree). '.' = no style.
  const st = Array.from({ length: H }, () => Array(W).fill('.'));
  const reserved = Array.from({ length: H }, () => Array(W).fill(false)); // no buildings or trees here
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, c) => inside(x, y) && (g[y][x] = c);
  const get = (x, y) => (inside(x, y) ? g[y][x] : null);
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const style = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) st[y][x] = c; };
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
  set(43, 103, 'L'); // the I LOVE KIGALI sign
  for (const a of CROWD_AREAS) reserve(a.x0, a.y0, a.x1, a.y1);
  reserve(130, 24, 191, 41); // the golf course: grass, sand and trees, no buildings

  // Marsh tracks (wet murram) on the river bank and in the wetland valleys.
  for (let x = 0; x < 64; x++) if (hash(x, 3, 11) < 0.35) set(x, 3, 'w');

  // Roads.
  for (const r of ROADS) {
    if (r.ring) continue;
    const w = (r.width ?? 2) - 1;
    if (r.y !== undefined) rect(r.x0, r.y, r.x1, r.y + w, r.surface);
    else rect(r.x, r.y0, r.x + w, r.y1, r.surface);
  }
  // The boulevard median: flower beds, with a gap where a road crosses (you can turn only there).
  const crossesAt = (x) => ROADS.some((q) => q.x !== undefined && !q.ring && x >= q.x && x <= q.x + 1 && q.y0 <= BOULEVARD.y && q.y1 >= BOULEVARD.y + 5);
  for (let x = BOULEVARD.x0; x <= BOULEVARD.x1; x++) {
    if (crossesAt(x) || crossesAt(x - 1) || crossesAt(x + 1)) continue; // the gap is a little wider than the road
    for (const y of [BOULEVARD.y + 2, BOULEVARD.y + 3]) set(x, y, 'f');
    reserve(x, BOULEVARD.y + 2, x, BOULEVARD.y + 3);
    // Tall palms along the median (Alp: palm trees, other trees and flowers).
    if (x % 3 === 0 && !crossesAt(x - 2) && !crossesAt(x + 2)) { set(x, BOULEVARD.y + 2, 't'); st[BOULEVARD.y + 2][x] = 'P'; }
  }

  // A stream in the valley between Nyabugogo and town (west) and Kacyiru and Kimihurura (east), from
  // Alp's terrain map; it runs into the Nyabugogo river. Roads cross it on bridges (the road stays).
  for (let y = 3; y < H; y++) if (!isRoad(get(63, y))) { set(63, y, 'r'); reserve(63, y, 63, y); }

  // Roundabouts: a round band of tarmac (2 tiles wide) around a round island. The island is grass
  // with flower beds (Alp: "grass and flowers"); the MTN island holds the yellow fountain.
  for (const r of ROADS.filter((q) => q.ring)) {
    for (let y = Math.floor(r.cy - r.r - 2); y <= r.cy + r.r + 2; y++) for (let x = Math.floor(r.cx - r.r - 2); x <= r.cx + r.r + 2; x++) {
      const d = Math.hypot(x + 0.5 - r.cx, y + 0.5 - r.cy);
      if (d >= r.r - 1 && d <= r.r + 1) set(x, y, r.surface);
      else if (d < r.r - 1) {
        set(x, y, '.'); // grass (the terrain draws the round island, the kerb and the flower beds)
        reserve(x, y, x, y);
      }
    }
    if (r.island === 'fountain') set(r.cx - 1, r.cy - 1, 'Y'); // the fountain stands on the centre point
  }

  // Stations and garages (2 tiles each, beside a road). facing: the side of the road.
  const places = [];
  const station = (x, y, c, facing, name, sign) => {
    set(x, y, c);
    set(x + 1, y, c);
    reserve(x - 1, y - 1, x + 2, y + 1);
    const tag = { F: 'fuel', S: 'swap', G: 'garage' }[c];
    const p = { north: { x: x + 1, y: y - 0.6 }, south: { x: x + 1, y: y + 1.6 }, west: { x: x - 0.6, y: y + 0.5 }, east: { x: x + 2.6, y: y + 0.5 } }[facing];
    places.push({ id: `${tag}-${x}-${y}`, name, ...p, tags: [tag], ...(sign ? { sign } : {}) });
  };
  station(46, 22, 'F', 'north', 'Nyabugogo fuel');
  station(20, 40, 'F', 'west', 'Gakinjiro fuel');
  station(38, 14, 'S', 'east', 'Ampersand swap, Nyabugogo');
  station(20, 24, 'G', 'west', 'Kazi ni Kazi garage', 'KAZI NI KAZI'); // Swahili: "work is work"
  station(12, 98, 'F', 'north', 'Town fuel');
  station(34, 98, 'S', 'north', 'Ampersand swap, town');
  station(102, 30, 'S', 'west', 'Ampersand swap, Kacyiru');
  station(86, 42, 'F', 'west', 'Kacyiru fuel');
  station(88, 98, 'F', 'north', 'Kimihurura fuel');
  station(162, 22, 'S', 'north', 'Ampersand swap, Nyarutarama');
  station(178, 22, 'F', 'north', 'Nyarutarama fuel');
  station(162, 98, 'F', 'north', 'Sonatubes fuel');
  station(146, 86, 'F', 'north', 'Gikondo fuel');
  station(180, 98, 'S', 'north', 'Ampersand swap, Kicukiro');
  station(180, 108, 'G', 'north', 'Sonatubes moto garage', 'SONATUBES');

  // Landmark buildings. levels: the height (it can be taller than 9); kind: the building style;
  // sign: the name on the building (towers: on the roof; offices and schools: on the front wall).
  const landmarks = [];
  const landmark = (x0, y0, x1, y1, c, kind, extra = {}) => {
    rect(x0, y0, x1, y1, c);
    style(x0, y0, x1, y1, kind);
    reserve(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    landmarks.push({ x0, y0, x1, y1, style: kind, ...extra });
  };
  landmark(33, 86, 35, 88, '9', 't', { levels: 18, sign: 'KIGALI CITY TOWER' });
  landmark(44, 76, 48, 79, '9', 't', { levels: 12, sign: 'CHIC' }); // shopping centre in town (behind the MTN roundabout)
  landmark(12, 86, 15, 90, '9', 't', { levels: 14, sign: 'KPC' });
  // The Kigali Marriott Hotel (Alp's map: in town, near the centre).
  landmark(52, 100, 58, 106, '9', 'H', { levels: 11, sign: 'KIGALI MARRIOTT', sign2: 'HOTEL' });
  landmark(14, 100, 18, 104, '3', 's', { sign: 'ISOKO RYA KIGALI', sign2: 'TOWN MARKET' });
  landmark(28, 112, 33, 117, '4', 'g', { sign: "IBIRO BY'AKARERE", sign2: 'KA NYARUGENGE' });
  landmark(44, 112, 49, 117, '3', 'c', { sign: 'LYCEE DE KIGALI', sign2: 'WE STRIVE FOR SUCCESS' });
  landmark(104, 6, 111, 12, '4', 'o', { sign: 'KING FAISAL HOSPITAL' });
  landmark(88, 24, 95, 30, '4', 'g', { sign: "POLISI Y'U RWANDA", sign2: 'POLICE' });
  landmark(103, 41, 110, 46, '5', 'g', { sign: "IBIRO BYA MINISITIRI", sign2: "W'INTEBE" });
  landmark(89, 41, 95, 46, '4', 'g', { sign: "IBIRO BY'AKARERE", sign2: 'KA GASABO' });
  // Ministries (Alp: some fly the flag, like MINEDUC and MINAGRI). The other offices do not.
  landmark(66, 26, 72, 31, '5', 'o', { sign: 'MINEDUC', sign2: 'MINISTRY OF EDUCATION', flag: true });
  landmark(74, 26, 81, 31, '5', 'o', { sign: 'MINAGRI', sign2: 'MINISTRY OF AGRICULTURE', flag: true });
  landmark(112, 43, 116, 46, '5', 'o', { sign: 'MINISANTE', sign2: 'MINISTRY OF HEALTH', flag: true });
  // Hotels (Alp). Places are guesses on the compressed map: the Mille Collines (the "Hotel Rwanda") and
  // the Serena in Kiyovu (town), the Umubano on the boulevard, the Radisson Blu beside the KCC.
  landmark(52, 112, 58, 117, '9', 'H', { levels: 12, sign: 'HOTEL DES', sign2: 'MILLE COLLINES' });
  landmark(14, 113, 19, 118, '9', 'H', { levels: 11, sign: 'KIGALI SERENA', sign2: 'HOTEL' });
  landmark(66, 41, 73, 46, '7', 'H', { sign: 'UMUBANO', sign2: 'HOTEL' });
  landmark(103, 82, 105, 87, '9', 'H', { levels: 10, sign: 'RADISSON BLU', sign2: 'HOTEL' });
  // The US Embassy (Alp): a big concrete building like a castle, with an American flag that waves.
  landmark(123, 23, 127, 28, '5', 'e', { sign: 'EMBASSY OF THE', sign2: 'UNITED STATES' });
  landmark(112, 51, 118, 53, '2', 'c', { sign: 'G.S. KACYIRU', sign2: 'WE STRIVE FOR SUCCESS' });
  landmark(89, 104, 94, 109, '4', 'g', { sign: 'INTEKO ISHINGA AMATEGEKO', sign2: 'PARLIAMENT' });
  landmark(116, 84, 119, 88, '9', 't', { levels: 11, sign: 'KIGALI HEIGHTS' });
  // The Ampersand office and e-moto showroom on Kacyiru boulevard: you buy your electric moto here (level 4).
  landmark(105, 30, 112, 32, '3', 'o', { sign: 'AMPERSAND', sign2: 'E-MOTO SHOWROOM', brand: true });
  landmark(140, 8, 143, 12, '7', 't', { levels: 10 }); // MTN Centre
  landmark(136, 27, 139, 29, '2', 'v'); // golf club house
  landmark(181, 87, 187, 93, '4', 'g', { sign: "IBIRO BY'AKARERE", sign2: 'KA KICUKIRO' });
  landmark(184, 109, 190, 111, '2', 'c', { sign: 'G.S. KICUKIRO', sign2: 'WE STRIVE FOR SUCCESS' });
  landmark(7, 41, 13, 42, '2', 'c', { sign: 'G.S. KIMISAGARA', sign2: 'WE STRIVE FOR SUCCESS' });
  rect(7, 43, 13, 45, 'm'); // the school yard (murram)
  reserve(7, 43, 13, 45);
  landmark(107, 83, 112, 88, 'K', '.'); // Kigali Convention Centre (dome)

  // Pavement beside busy tarmac roads (people walk here).
  const paved = (x, y) => {
    const d = districtOf(x, y);
    if (d === 'town') return levelAt(x, y) > 5;
    if (d === 'nyabugogo') return y <= 24 && x >= 6;
    if (d === 'kacyiru') return y >= 33 && y <= 40; // the boulevard
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
    if (onMountKigali(x, y)) continue; // forest (see the trees)
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
    if (c) {
      set(x, y, c);
      // The style of the building: it changes the walls, windows and roof details.
      let k = 'h';
      if (d === 'nyabugogo') k = x < 17 && y > 22 ? 'h' : nearRoad(x, y, 2) ? 's' : 'h';
      else if (d === 'town') k = lvl < 5 ? 'h' : Number(c) >= 8 ? 't' : nearRoad(x, y, 2) && lot(x, y, 3, 21) < 0.4 ? 's' : 'o';
      else if (d === 'kacyiru') k = 'o';
      else if (d === 'kimihurura' || d === 'nyarutarama') k = 'v';
      else if (d === 'kicukiro') k = x < 144 && y >= 100 ? 'w' : nearRoad(x, y, 2) ? 's' : 'h';
      st[y][x] = k;
    }
  }
  // Market stalls are shops.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '2' && st[y][x] === '.') st[y][x] = 's';

  // Trees: avenue trees on the Kacyiru boulevard, many trees in the rich districts and the golf course.
  const treeChance = { nyabugogo: 0.04, town: 0.05, kacyiru: 0.1, kimihurura: 0.12, nyarutarama: 0.12, kicukiro: 0.05 };
  for (let y = 4; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    if (g[y][x] !== '.' || (reserved[y][x] && !(y >= 24 && y <= 41 && x >= 130))) continue;
    const golf = y >= 24 && y <= 41 && x >= 130;
    const forest = onMountKigali(x, y) ? 0.38 : 0; // Mount Kigali is green with eucalyptus forest
    if (hash(x, y, 16) < (golf ? 0.06 : forest || treeChance[districtOf(x, y)])) { set(x, y, 't'); if (forest) st[y][x] = 'F'; }
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
    if (r.surface !== '#' || r.ring) continue;
    if (r.median) {
      // Lamps in the median between the palms (Alp), with the arm over each carriageway in turn.
      for (let x = r.x0 + 2, i = 0; x <= r.x1 - 2; x += step, i++) {
        if (get(x, r.y + 3) !== 'f') continue;
        lamps.push({ x: x + 0.5, y: r.y + 3.5, side: i % 2 ? 'north' : 'south' });
      }
      continue;
    }
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

  for (let x = 105; x <= 112; x++) set(x, 33, 'p'); // the Ampersand showroom: a paved forecourt, no trees
  const rows = g.map((r) => r.join(''));
  const styles = st.map((r) => r.join(''));

  // Job places. weight: how often jobs start here (the bus park makes many fares).
  const P = (id, name, x, y, tags = [], weight = 1) => places.push({ id, name, x, y, tags, weight });
  P('busPark', 'Nyabugogo bus park', 29, 15, ['market'], 5);
  P('ampersandOffice', 'Ampersand showroom, Kacyiru boulevard', 108.5, 33.5, ['office']);
  P('market', 'Nyabugogo market', 52, 13.5, ['market'], 3);
  P('riverRoad', 'River road', 12, 6, []);
  P('gakinjiro', 'Gakinjiro workshops', 30, 33, ['market']);
  P('kimisagara', 'Kimisagara hillside', 5, 40, [], 1);
  P('kimisagaraLane', 'Kimisagara lane', 12, 39, []);
  P('muhimaFoot', 'Valley road', 50, 45, []);
  P('kinamba', 'Kinamba', 62, 30, []);
  P('muhima', 'Muhima hill', 41, 62, []);
  P('townRoundabout', 'Town roundabout', 26, 90, [], 2);
  P('cityTower', 'Kigali City Tower', 36.5, 89, [], 2);
  P('mtnRoundabout', 'MTN roundabout', 41, 79.5, [], 2);
  P('townMarket', 'Kigali town market', 13, 104, ['market'], 2);
  P('carFree', 'Car free zone', 41, 105, [], 1);
  P('kiyovu', 'Kiyovu', 30, 121, []);
  P('nyamirambo', 'Nyamirambo road', 11, 74, []);
  P('hospital', 'King Faisal Hospital', 102.5, 10, [], 2);
  P('policeHq', 'Police headquarters', 86.5, 28, []);
  P('kacyiruBoulevard', 'Kacyiru boulevard', 96, 34.5, []);
  P('usEmbassy', 'US Embassy', 122, 29.5, [], 1);
  P('mineduc', 'MINEDUC', 69, 33.5, [], 1);
  P('minagri', 'MINAGRI', 77.5, 33.5, [], 1);
  P('minisante', 'MINISANTE', 113.5, 48.5, [], 1);
  // Hotels: many fares (visitors and conference guests).
  P('milleCollines', 'Hotel des Mille Collines', 56, 119.5, ['hotel'], 2);
  P('serena', 'Kigali Serena Hotel', 16.5, 112.5, ['hotel'], 2);
  P('umubano', 'Umubano Hotel', 70, 40.5, ['hotel'], 2);
  P('radisson', 'Radisson Blu Hotel', 101.5, 85, ['hotel'], 2);
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
  P('gsKimisagara', 'G.S. Kimisagara', 10, 44, [], 1);
  P('lycee', 'Lycee de Kigali', 46, 118.5, [], 1);
  P('nyarugengeOffice', 'Nyarugenge district office', 30, 118.5, [], 1);
  P('gasaboOffice', 'Gasabo district office', 92, 48.5, [], 1);
  P('pmOffice', "Prime Minister's office", 106, 48.5, [], 1);
  P('gsKacyiru', 'G.S. Kacyiru', 115, 50, [], 1);
  P('kigaliHeights', 'Kigali Heights', 115, 89.5, [], 2);
  P('marriott', 'Kigali Marriott Hotel', 55, 98.5, ['hotel'], 2);
  P('chic', 'CHIC shopping centre', 47.5, 80.5, [], 2);
  P('kicukiroOffice', 'Kicukiro district office', 184, 94.5, [], 1);
  P('gsKicukiro', 'G.S. Kicukiro', 187, 108.5, [], 1);
  P('airportRoad', 'Airport road', 189, 97, []);
  for (const p of places) p.district = districtOf(Math.floor(p.x), Math.floor(p.y));

  return {
    name: 'Kigali',
    start: { x: 30, y: 21, headingDeg: 0 },
    rows,
    styles,
    landmarks,
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
    police: [{ x: 39.5, y: 106.5, post: true }], // the car free zone has its own officer (Alp)
    autoSigns: true, // speed limit, speed bump and crossing signs from the roads (world/road-signs.js)
    busStops: [
      { x: 29, y: 12, side: 'north', park: true }, // Nyabugogo bus park
      { x: 52, y: 22, side: 'south' },
      { x: 90, y: 20, side: 'north' },
      { x: 150, y: 22, side: 'south' },
      { x: 18, y: 98, side: 'south' },
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
