import { WORLD, PALETTE as P, GARDEN_WALLS as GW } from '../config.js';
import { toScreen } from './iso.js';
import { PixelCanvas, hash2 } from './pixel-canvas.js';
import { tone } from './palette.js';

// Garden walls around the villas (Kimihurura): a painted wall around each compound with one steel
// gate on the side of the road. The plan (gardenWalls) and the art (drawWallSegment). No Phaser here.
//
// A compound is the villa and the grass ring around it (one tile). The wall stands on the outer edges
// of the ring. A tree in the ring stays in the garden.

const T = WORLD.tileMetres;
const EDGES = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const ROADLIKE = new Set(['tarmac', 'cobble', 'murram', 'murramWet', 'pavement']);

/**
 * The wall segments: [{ tx, ty, edge: 'n'|'e'|'s'|'w', gate, compound }]. A segment is the edge of
 * one tile. compound: a number (the colours of a compound come from it).
 */
export function gardenWalls(world, districts = GW.districts) {
  const key = (x, y) => x + ',' + y;
  const villa = world.tiles.filter((t) => t.block === 'building' && t.style === 'villa' && !t.landmark && districts.includes(t.district));
  // Each villa (a block group) is one compound. A ring tile goes to the nearest villa.
  const owner = new Map(); // key → compound id
  for (const t of villa) owner.set(key(t.tx, t.ty), world.blockAt(t.tx, t.ty).groupId);
  const centre = new Map();
  for (const t of villa) {
    const id = owner.get(key(t.tx, t.ty));
    const c = centre.get(id) ?? { x: 0, y: 0, n: 0 };
    centre.set(id, { x: c.x + t.tx, y: c.y + t.ty, n: c.n + 1 });
  }
  const dist = (id, t) => {
    const c = centre.get(id);
    return Math.hypot(c.x / c.n - t.tx, c.y / c.n - t.ty);
  };
  const ring = [];
  const inRing = new Set();
  for (const t of villa) {
    const id = owner.get(key(t.tx, t.ty));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const n = world.tile(t.tx + dx, t.ty + dy);
      if (!n || n.surface !== 'grass' || (n.block && n.block !== 'tree') || !districts.includes(n.district)) continue;
      const k = key(n.tx, n.ty), was = owner.get(k);
      if (was === undefined) {
        ring.push(n);
        inRing.add(k);
      }
      if (was === undefined || (inRing.has(k) && dist(id, n) < dist(was, n))) owner.set(k, id);
    }
  }
  const isVilla = new Set(villa.map((t) => key(t.tx, t.ty)));
  // The walls: on the outer edges of the ring, and between the gardens of two villas (drawn once).
  // Not on a tree tile (the tree stays in the garden) and not along a house wall.
  const segs = [];
  for (const t of ring) {
    if (t.block === 'tree') continue;
    const id = owner.get(key(t.tx, t.ty));
    for (const [edge, [dx, dy]] of Object.entries(EDGES)) {
      const nk = key(t.tx + dx, t.ty + dy), other = owner.get(nk);
      if (other === id || isVilla.has(nk)) continue;
      if (other !== undefined && world.tile(t.tx + dx, t.ty + dy).block !== 'tree' && other < id) continue; // the other garden draws it
      const out = world.tile(t.tx + dx, t.ty + dy);
      const outer = other === undefined;
      segs.push({ tx: t.tx, ty: t.ty, edge, gate: false, compound: id, outer, road: outer && !!out && ROADLIKE.has(out.surface) && !out.block });
    }
  }
  // One gate for each compound: on the road side if it can, nearest to the middle of the villa.
  const byCompound = new Map();
  for (const s of segs) if (s.outer) (byCompound.get(s.compound) ?? byCompound.set(s.compound, []).get(s.compound)).push(s);
  for (const [id, list] of byCompound) {
    list.sort((a, b) => b.road - a.road || dist(id, a) - dist(id, b));
    list[0].gate = true;
  }
  for (const s of segs) {
    delete s.road;
    delete s.outer;
  }
  return segs;
}

/** The two ends of a segment (tiles), moved a little into the tile. */
export function segmentEnds(seg) {
  const i = GW.insetTiles, { tx, ty } = seg;
  if (seg.edge === 'n') return [{ x: tx, y: ty + i }, { x: tx + 1, y: ty + i }];
  if (seg.edge === 's') return [{ x: tx, y: ty + 1 - i }, { x: tx + 1, y: ty + 1 - i }];
  if (seg.edge === 'w') return [{ x: tx + i, y: ty }, { x: tx + i, y: ty + 1 }];
  return [{ x: tx + 1 - i, y: ty }, { x: tx + 1 - i, y: ty + 1 }];
}

/** Is the point (metres) inside the wall (for collisions)? */
export function hitsWall(seg, x, y) {
  const [a, b] = segmentEnds(seg);
  const half = GW.solidMetres / 2;
  if (a.y === b.y) return Math.abs(y - a.y * T) < half && x >= a.x * T - half && x <= b.x * T + half;
  return Math.abs(x - a.x * T) < half && y >= a.y * T - half && y <= b.y * T + half;
}

/** The colours of a compound: the wall paint, the top and the foot band, and the gate. */
export function compoundLook(compound) {
  const pick = (list, k) => list[Math.floor(hash2(compound, k, 41) * list.length) % list.length];
  return {
    wall: pick([P.cream, P.paintCream, P.paintPeach, P.paintOchre, P.concrete, P.paintTerracotta], 1),
    top: pick([P.brick, P.concrete, P.stone], 2),
    foot: pick([P.stone, P.brick, P.slate], 3),
    gate: pick([P.charcoal, P.kGreen, P.kBlue, P.roofRed], 4),
  };
}

/**
 * The art of one wall segment: { canvas, depth }. The wall stands on the ground, GW.heightMetres
 * high; the face that looks to +y has the mid tone, the face that looks to +x the dark tone (light rule).
 */
export function drawWallSegment(seg, world) {
  const L = WORLD.levelMetres;
  const [a, b] = segmentEnds(seg);
  const za = world.heightAt(a.x * T, a.y * T), zb = world.heightAt(b.x * T, b.y * T);
  const h = GW.heightMetres * (seg.gate ? GW.gateFactor : 1);
  const A0 = toScreen(a.x * T, a.y * T, za), B0 = toScreen(b.x * T, b.y * T, zb);
  const A1 = toScreen(a.x * T, a.y * T, za + h), B1 = toScreen(b.x * T, b.y * T, zb + h);
  const pillar = (GW.pillarMetres / L) * WORLD.levelPx;
  const pts = [A0, B0, A1, B1];
  const minX = Math.floor(Math.min(...pts.map((p) => p.x))) - 2, maxX = Math.ceil(Math.max(...pts.map((p) => p.x))) + 2;
  const minY = Math.floor(Math.min(...pts.map((p) => p.y))) - Math.ceil(pillar) - 3, maxY = Math.ceil(Math.max(...pts.map((p) => p.y))) + 2;
  const c = new PixelCanvas(maxX - minX, maxY - minY, minX, minY);
  const look = compoundLook(seg.compound);
  const face = seg.edge === 'n' || seg.edge === 's' ? 'left' : 'right';
  const q = (p, u, v) => ({ x: p.x, y: p.y, u, v });
  if (!seg.gate) {
    c.fillQuad(q(A1, 0, 0), q(B1, 1, 0), q(B0, 1, 1), q(A0, 0, 1), (u, v) => tone(v < GW.topShare ? look.top : v > 1 - GW.footShare ? look.foot : look.wall, face));
    // The top of the wall (a lit line, so the wall has some thickness).
    c.line(A1.x, A1.y - 1, B1.x, B1.y - 1, 1, tone(look.top, 'top'));
  } else {
    // A steel gate between two pillars. The pillars are higher than the gate.
    const pw = GW.pillarShare;
    c.fillQuad(q(A1, 0, 0), q(B1, 1, 0), q(B0, 1, 1), q(A0, 0, 1), (u, v, px) => {
      if (u < pw || u > 1 - pw) return tone(look.wall, face);
      return px % 3 === 0 ? tone(look.gate, 'right') : tone(look.gate, face);
    });
    for (const [p0, p1, u] of [[A0, A1, 0], [B0, B1, 1]]) {
      const top = { x: p1.x, y: p1.y - pillar };
      const dx = (B0.x - A0.x) * pw, dy = (B0.y - A0.y) * pw;
      const s = u ? -1 : 1;
      c.fillQuad(q(top, 0, 0), q({ x: top.x + s * dx, y: top.y + s * dy }, 1, 0), q({ x: p0.x + s * dx, y: p0.y + s * dy }, 1, 1), q(p0, 0, 1), (uu, v) => tone(v < 0.15 ? look.top : look.wall, face));
      c.line(top.x, top.y - 1, top.x + s * dx, top.y + s * dy - 1, 1, tone(look.top, 'top'));
    }
  }
  return { canvas: c, depth: (a.x + b.x) / 2 + (a.y + b.y) / 2 };
}
