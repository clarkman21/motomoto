import { mulberry32 } from '../../sim/jobs.js';

// The district slice for milestone 3: a compressed Nyabugogo to city centre map.
// It is built in code (not drawn by hand) because it is 96 × 80 tiles.
// The result has the same shape as TEST_MAP (rows, hills, places, zones, cameras, signs)
// plus `roads` (the road network for traffic) and `busStops`.
//
// Layout (x goes right and down on screen, y goes left and down):
//   Valley (west, low): river along the north edge, bus park, market, garage, fuel and swap.
//   Main road (y = 20): from the valley up a gentle then steep climb to the city plateau.
//   City centre (east plateau, x >= 51): street grid, tall buildings, pavements, swap station.
//   Residential hills (south): murram and cobblestone lanes, houses.

export const KIGALI_W = 96;
export const KIGALI_H = 80;

// Roads: horizontal { y, x0, x1 } uses rows y and y+1; vertical { x, y0, y1 } uses columns x and x+1.
const ROADS = [
  // Valley
  { name: 'Main road', y: 20, x0: 0, x1: 95, surface: '#' },
  { name: 'River road', y: 6, x0: 0, x1: 41, surface: '#' },
  { name: 'West road', x: 2, y0: 6, y1: 77, surface: '#' },
  { name: 'Gakinjiro road', x: 18, y0: 6, y1: 77, surface: '#' },
  { name: 'Valley east road', x: 40, y0: 6, y1: 41, surface: '#' },
  { name: 'Valley murram', x: 40, y0: 42, y1: 77, surface: 'm' },
  // City centre
  { name: 'City north street', y: 10, x0: 51, x1: 95, surface: '#' },
  { name: 'City south street', y: 32, x0: 51, x1: 95, surface: '#' },
  { name: 'Old town street', y: 46, x0: 51, x1: 85, surface: 'c' },
  { name: 'Avenue 1', x: 58, y0: 10, y1: 47, surface: '#' },
  { name: 'Avenue 2', x: 70, y0: 4, y1: 47, surface: '#' },
  { name: 'East road', x: 84, y0: 4, y1: 77, surface: '#' },
  // Residential hills
  { name: 'Hill murram lane', y: 58, x0: 18, x1: 85, surface: 'm' },
  { name: 'Hill cobble lane', y: 68, x0: 18, x1: 85, surface: 'c' },
  { name: 'South road', y: 76, x0: 2, x1: 95, surface: '#' },
  { name: 'Steep murram', x: 32, y0: 58, y1: 77, surface: 'm' },
  { name: 'Hill road', x: 52, y0: 46, y1: 77, surface: 'm' },
];

const HILLS = [
  // The main road climbs: gentle (19%) from x = 42 to 48, then steep (37%) from 48 to 51.
  { name: 'Lower city', x0: 48, y0: 0, x1: 96, y1: 52, level: 3, run: { west: 2, east: 1, north: 1, south: 2 } },
  { name: 'City plateau', x0: 51, y0: 0, x1: 96, y1: 50, level: 6, run: { west: 1, east: 1, north: 1, south: 2 } },
  { name: 'Residential hill', x0: 24, y0: 60, x1: 70, y1: 74, level: 3, run: { west: 2, east: 2, north: 1.5, south: 1 } },
  { name: 'Steep hill top', x0: 28, y0: 64, x1: 38, y1: 72, level: 5, run: { west: 1, east: 1, north: 1, south: 1 } },
];

export function buildKigaliMap(seed = 7) {
  const rng = mulberry32(seed);
  const W = KIGALI_W, H = KIGALI_H;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, c) => inside(x, y) && (g[y][x] = c);
  const get = (x, y) => (inside(x, y) ? g[y][x] : null);
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const isRoad = (c) => c === '#' || c === 'm' || c === 'c' || c === 'o' || c === '=';
  const hash = (x, y, k = 0) => {
    let h = (x * 374761393 + y * 668265263 + (seed + k) * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  // River along the north edge of the valley.
  rect(0, 0, 45, 2, 'r');

  // Lots before roads, so roads cut through them.
  rect(5, 8, 16, 17, '#'); // bus park
  rect(21, 8, 37, 18, 'm'); // market ground
  // Market stalls: rows of small buildings with aisles between them.
  for (let y = 9; y <= 17; y += 3) for (let x = 22; x <= 36; x++) if (x % 5 !== 1) set(x, y, '2');

  // Roads.
  for (const r of ROADS) {
    if (r.y !== undefined) rect(r.x0, r.y, r.x1, r.y + 1, r.surface);
    else rect(r.x, r.y0, r.x + 1, r.y1, r.surface);
  }

  // Pavement beside the city and valley roads (people walk here).
  const paved = (x, y) => x >= 51 || (y >= 18 && y <= 23 && x <= 42) || (x >= 4 && x <= 17 && y >= 7 && y <= 18);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.' || !paved(x, y)) continue;
    const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoad(get(x + dx, y + dy)));
    if (nearRoad) set(x, y, 'p');
  }

  // City buildings: tall blocks, one height per 3 × 3 lot, with a few small plazas.
  for (let y = 4; y < 50; y++) for (let x = 52; x < W - 1; x++) {
    if (g[y][x] !== '.') continue;
    const lx = Math.floor(x / 3), ly = Math.floor(y / 3);
    if (hash(lx, ly, 1) < 0.12) continue; // plaza
    set(x, y, String(4 + Math.floor(hash(lx, ly, 2) * 6))); // 4..9 levels
  }
  // Residential houses: small, with gardens between them.
  for (let y = 50; y < H - 1; y++) for (let x = 4; x < W - 1; x++) {
    if (g[y][x] !== '.') continue;
    const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoad(get(x + dx, y + dy)));
    if (nearRoad) continue;
    if (hash(x >> 1, y >> 1, 3) < 0.45) set(x, y, String(2 + Math.floor(hash(x >> 1, y >> 1, 4) * 2)));
  }
  // Valley workshops and shops along the main road.
  for (let y = 24; y < 50; y++) for (let x = 4; x < 40; x++) {
    if (g[y][x] !== '.') continue;
    const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoad(get(x + dx, y + dy)));
    if (!nearRoad && hash(x >> 1, y >> 1, 5) < 0.3) set(x, y, String(2 + Math.floor(hash(x >> 1, y >> 1, 6) * 3)));
  }

  // Stations and the garage (2 tiles each, beside a road).
  const station = (x, y, c) => { set(x, y, c); set(x + 1, y, c); };
  station(36, 22, 'F'); // fuel, valley main road
  station(5, 22, 'S'); // swap, valley
  station(62, 13, 'S'); // swap, city
  station(15, 24, 'G'); // garage, Gakinjiro
  rect(15, 25, 16, 25, '.');

  // Trees on open grass.
  for (let y = 4; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    if (g[y][x] === '.' && hash(x, y, 7) < 0.07) set(x, y, 't');
  }

  // Potholes on valley tarmac and murram roads; speed bumps near the market and bus park.
  const isJunction = (x, y) => isRoad(get(x + 2, y)) && isRoad(get(x, y + 2)) && isRoad(get(x - 2, y)) && isRoad(get(x, y - 2));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = g[y][x];
    if ((c === '#' && x < 48 && y > 4) || c === 'm') {
      if (hash(x, y, 8) < (c === 'm' ? 0.03 : 0.015) && !isJunction(x, y) && c === '#') set(x, y, 'o');
    }
  }
  for (const x of [24, 34]) { set(x, 20, '='); set(x, 21, '='); }
  for (const y of [12]) { set(18, y, '='); set(19, y, '='); }
  for (const x of [62, 76]) { set(x, 32, '='); set(x, 33, '='); }

  const rows = g.map((r) => r.join(''));

  return {
    name: 'Nyabugogo to city centre',
    start: { x: 12, y: 21, headingDeg: 0 },
    rows,
    hills: HILLS,
    roads: ROADS,
    places: [
      { id: 'busPark', name: 'Nyabugogo bus park', x: 11, y: 12, tags: ['market'] },
      { id: 'market', name: 'Nyabugogo market', x: 31, y: 11, tags: ['market'] },
      { id: 'riverRoad', name: 'River road', x: 30, y: 7, tags: [] },
      { id: 'gakinjiro', name: 'Gakinjiro', x: 19, y: 34, tags: [] },
      { id: 'valleyEast', name: 'Valley east road', x: 41, y: 30, tags: [] },
      { id: 'cityHall', name: 'City hall', x: 64, y: 11, tags: [] },
      { id: 'hotel', name: 'Hotel des Mille Collines', x: 77, y: 33, tags: [] },
      { id: 'offices', name: 'Office towers', x: 59, y: 40, tags: [] },
      { id: 'cityEast', name: 'City east', x: 90, y: 21, tags: [] },
      { id: 'oldTown', name: 'Old town', x: 66, y: 47, tags: [] },
      { id: 'nyamirambo', name: 'Steep murram lane', x: 33, y: 64, tags: [] },
      { id: 'hillLane', name: 'Hill murram lane', x: 60, y: 59, tags: [] },
      { id: 'school', name: 'School', x: 70, y: 69, tags: [] },
      { id: 'southRoad', name: 'South road', x: 40, y: 77, tags: [] },
      { id: 'westRoad', name: 'West road', x: 3, y: 50, tags: [] },
      { id: 'fuel', name: 'Fuel station', x: 37, y: 21.4, tags: ['fuel'] },
      { id: 'swap', name: 'Ampersand swap (city)', x: 63, y: 11.4, tags: ['swap'] },
      { id: 'swapValley', name: 'Ampersand swap (valley)', x: 6, y: 21.4, tags: ['swap'] },
      { id: 'garage', name: 'Gakinjiro garage', x: 18.4, y: 24.5, tags: ['garage'] },
    ],
    zones: [
      { name: 'Market and bus park', x0: 4, y0: 4, x1: 40, y1: 20, limitKmh: 30 },
      { name: 'City centre', x0: 51, y0: 0, x1: 96, y1: 50, limitKmh: 40 },
      { name: 'Residential hills', x0: 18, y0: 54, x1: 88, y1: 74, limitKmh: 30 },
    ],
    cameras: [
      { x: 30, y: 22.3 }, // valley main road, open road (60)
      { x: 66, y: 22.3 }, // city main road (40)
      { x: 86.2, y: 40 }, // east road (40)
      { x: 20.2, y: 45 }, // Gakinjiro road (60)
      { x: 60, y: 75.7 }, // south road (60)
    ],
    signs: [
      { x: 50.6, y: 22.4, limitKmh: 40 },
      { x: 17.6, y: 18.6, limitKmh: 30 },
      { x: 39.6, y: 18.6, limitKmh: 30 },
      { x: 86.4, y: 50.6, limitKmh: 40 },
      { x: 17.6, y: 53.6, limitKmh: 30 },
      { x: 51.6, y: 53.6, limitKmh: 30 },
    ],
    busStops: [
      { x: 10, y: 20, side: 'north' },
      { x: 28, y: 22, side: 'south' },
      { x: 64, y: 22, side: 'south' },
      { x: 76, y: 31, side: 'north' },
      { x: 20, y: 40, side: 'east' },
      { x: 86, y: 60, side: 'east' },
    ],
  };
}
