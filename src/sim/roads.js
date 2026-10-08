import { WORLD } from '../config.js';

// The road network for traffic, built from the map's road list. No Phaser here.
// Roads are 2 tiles wide and follow the grid. Each road's centre line is cut at every
// crossing with another road; the cut points are nodes, the pieces between them are edges
// (one edge per direction). Positions are in metres.

export const LANE_OFFSET = 2; // metres from the centre line to the middle of a lane (right hand traffic)
export const RING_POINTS = 16; // nodes around a roundabout

// Roundabouts: { ring: true, cx, cy, r } (tiles; (cx, cy) is the centre, a grid point; r: the radius
// of the ring's centre line). The ring is one way: anticlockwise, seen from above (Rwanda drives on
// the right). Roads that meet the ring end on it (at the north, south, west or east point).

/** The lane offset (metres to the right of the centre line) of a road. One way rings: 0 (the middle). */
export function roadLane(road) {
  if (road?.ring) return 0;
  return road?.laneOffset ?? LANE_OFFSET;
}

export function buildRoadGraph(roads) {
  const T = WORLD.tileMetres;
  const rings = roads.filter((r) => r.ring);
  roads = roads.filter((r) => !r.ring);
  // Centre lines in tile units: horizontal roads run along x, vertical ones along y.
  // A road is 2 tiles wide, or `width` tiles (a double carriageway: its centre line is in the median).
  const lines = roads.map((r) =>
    r.y !== undefined ? { horiz: true, c: r.y + (r.width ?? 2) / 2, a: r.x0, b: r.x1 + 1, road: r } : { horiz: false, c: r.x + (r.width ?? 2) / 2, a: r.y0, b: r.y1 + 1, road: r },
  );
  const nodes = [];
  const nodeAt = new Map();
  const node = (tx, ty) => {
    const key = `${Math.round(tx * 1000)},${Math.round(ty * 1000)}`;
    if (!nodeAt.has(key)) {
      const n = { id: nodes.length, x: tx * T, y: ty * T, out: [] };
      nodes.push(n);
      nodeAt.set(key, n);
    }
    return nodeAt.get(key);
  };
  const edges = [];
  const addEdge = (from, to, road) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.01) return null;
    const e = { id: edges.length, from, to, length, dx: dx / length, dy: dy / length, road, reverse: null };
    edges.push(e);
    from.out.push(e);
    return e;
  };
  for (const L of lines) {
    const cuts = new Set([L.a, L.b]);
    for (const M of lines) {
      if (M.horiz === L.horiz) continue;
      if (M.c >= L.a && M.c <= L.b && L.c >= M.a && L.c <= M.b) cuts.add(M.c);
    }
    const sorted = [...cuts].sort((p, q) => p - q);
    for (let i = 0; i < sorted.length - 1; i++) {
      const A = L.horiz ? node(sorted[i], L.c) : node(L.c, sorted[i]);
      const B = L.horiz ? node(sorted[i + 1], L.c) : node(L.c, sorted[i + 1]);
      const ab = addEdge(A, B, L.road);
      const ba = addEdge(B, A, L.road);
      if (ab && ba) {
        ab.reverse = ba;
        ba.reverse = ab;
      }
    }
  }
  // The rings: nodes on a circle, one edge each way round (anticlockwise on the screen = the angle
  // gets smaller, because y goes down). No reverse edges: you cannot drive the wrong way round.
  for (const R of rings) {
    const pts = [];
    for (let k = 0; k < RING_POINTS; k++) {
      const a = (k / RING_POINTS) * Math.PI * 2;
      pts.push(node(R.cx + R.r * Math.cos(a), R.cy + R.r * Math.sin(a)));
    }
    for (let k = 0; k < RING_POINTS; k++) addEdge(pts[k], pts[(k + RING_POINTS - 1) % RING_POINTS], R);
  }
  return { nodes, edges };
}

/** Point in the right hand lane of an edge, s metres from its start. */
export function lanePoint(edge, s, offset = roadLane(edge.road)) {
  return {
    x: edge.from.x + edge.dx * s - edge.dy * offset,
    y: edge.from.y + edge.dy * s + edge.dx * offset,
  };
}

/** The node nearest to a point. */
export function nearestNode(graph, x, y) {
  let best = null, bestD = Infinity;
  for (const n of graph.nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** Shortest path (list of edges) from node a to node b, or null. Dijkstra on edge length. */
export function shortestPath(graph, a, b) {
  if (a === b) return [];
  const dist = new Map([[a.id, 0]]);
  const prev = new Map();
  const open = [a];
  const done = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist.get(open[i].id) < dist.get(open[bi].id)) bi = i;
    const n = open.splice(bi, 1)[0];
    if (done.has(n.id)) continue;
    done.add(n.id);
    if (n === b) break;
    for (const e of n.out) {
      const d = dist.get(n.id) + e.length;
      if (d < (dist.get(e.to.id) ?? Infinity)) {
        dist.set(e.to.id, d);
        prev.set(e.to.id, e);
        open.push(e.to);
      }
    }
  }
  if (!prev.has(b.id)) return null;
  const path = [];
  for (let n = b; n !== a; n = prev.get(n.id).from) path.unshift(prev.get(n.id));
  return path;
}

/**
 * The part of the road list inside the open districts (for traffic). A road that goes into a
 * closed district stops at the district edge. districts: [{ id, x0, y0, x1, y1 }], open: [ids].
 */
export function openRoads(roads, districts, open) {
  if (!districts?.length) return roads;
  const rects = districts.filter((d) => open.includes(d.id));
  const out = [];
  for (const r of roads) {
    if (r.ring) {
      // A ring stays when its centre is in an open district.
      if (rects.some((d) => r.cx >= d.x0 && r.cx < d.x1 && r.cy >= d.y0 && r.cy < d.y1)) out.push(r);
      continue;
    }
    const horiz = r.y !== undefined;
    const c = horiz ? r.y : r.x; // first row (or column) of the road
    const w = r.width ?? 2;
    const [a, b] = horiz ? [r.x0, r.x1] : [r.y0, r.y1];
    // Open intervals along the road (tiles, inclusive), merged.
    const spans = rects
      .filter((d) => (horiz ? c >= d.y0 && c + w - 1 < d.y1 : c >= d.x0 && c + w - 1 < d.x1))
      .map((d) => (horiz ? [d.x0, d.x1 - 1] : [d.y0, d.y1 - 1]))
      .sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]);
      else merged.push([...s]);
    }
    for (const [lo, hi] of merged) {
      const s0 = Math.max(a, lo), s1 = Math.min(b, hi);
      if (s1 - s0 < 2) continue;
      out.push(horiz ? { ...r, x0: s0, x1: s1 } : { ...r, y0: s0, y1: s1 });
    }
  }
  return out;
}
