import { WORLD } from '../config.js';

// The road network for traffic, built from the map's road list. No Phaser here.
// Roads are 2 tiles wide and follow the grid. Each road's centre line is cut at every
// crossing with another road; the cut points are nodes, the pieces between them are edges
// (one edge per direction). Positions are in metres.

export const LANE_OFFSET = 2; // metres from the centre line to the middle of a lane (right hand traffic)

export function buildRoadGraph(roads) {
  const T = WORLD.tileMetres;
  // Centre lines in tile units: horizontal roads run along x, vertical ones along y.
  const lines = roads.map((r) =>
    r.y !== undefined ? { horiz: true, c: r.y + 1, a: r.x0, b: r.x1 + 1, road: r } : { horiz: false, c: r.x + 1, a: r.y0, b: r.y1 + 1, road: r },
  );
  const nodes = [];
  const nodeAt = new Map();
  const node = (tx, ty) => {
    const key = `${tx},${ty}`;
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
  return { nodes, edges };
}

/** Point in the right hand lane of an edge, s metres from its start. */
export function lanePoint(edge, s, offset = LANE_OFFSET) {
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
