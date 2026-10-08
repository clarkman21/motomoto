import { RESCUE, FUEL, MONEY, WORLD } from '../config.js';
import { nearestNode, shortestPath } from './roads.js';
import { round10 } from './economy.js';

// The emergency fuel moto: you phone a moto rider at the nearest station, who brings you 1 litre of
// fuel (or a charged battery for the electric moto) for the station price plus a premium. You can
// call at any time, but most of all when the tank is empty. No Phaser here.

/** What the call brings and costs. Petrol: 1 litre. Electric: a full battery. priceFactor: petrol price. */
export function rescueOffer(bikeType, priceFactor = 1) {
  if (bikeType === 'electric') return { energy: 1, cost: round10(MONEY.swapFee * (1 + RESCUE.premium)), what: 'a charged battery' };
  const litre = 1 / FUEL.tankLitres; // the part of the tank that 1 litre fills
  return { energy: litre, cost: round10((MONEY.fuelFullTank / FUEL.tankLitres) * priceFactor * (1 + RESCUE.premium)), what: '1 litre of fuel' };
}

/**
 * Start a call. graph: the road graph; stations: [{ x, y }] (tiles) for this bike type; bike: { x, y } (metres).
 * Returns the moto { points, i, x, y, heading, state, wait, eta } or null when there is no station.
 * The moto waits answerSeconds (the call), rides along the roads to you, gives you the fuel, and leaves.
 */
export function createRescue(graph, stations, bike) {
  if (!stations.length || !graph.nodes.length) return null;
  const T = WORLD.tileMetres;
  const station = stations.reduce((best, s) => (Math.hypot(s.x * T - bike.x, s.y * T - bike.y) < Math.hypot(best.x * T - bike.x, best.y * T - bike.y) ? s : best));
  const start = { x: station.x * T, y: station.y * T };
  const a = nearestNode(graph, start.x, start.y), b = nearestNode(graph, bike.x, bike.y);
  const path = shortestPath(graph, a, b) ?? [];
  const points = [start, { x: a.x, y: a.y }, ...path.map((e) => ({ x: e.to.x, y: e.to.y }))];
  const r = { points, i: 1, x: start.x, y: start.y, heading: 0, state: 'call', wait: RESCUE.answerSeconds, back: null };
  r.eta = RESCUE.answerSeconds + routeLength([...points, { x: bike.x, y: bike.y }]) / (RESCUE.speedKmh / 3.6);
  return r;
}

function routeLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return d;
}

/** Move toward a point. Returns true when there. */
function moveTo(r, p, step) {
  const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy);
  if (d > 0.01) r.heading = Math.atan2(dy, dx);
  if (d <= step) {
    r.x = p.x;
    r.y = p.y;
    return true;
  }
  r.x += (dx / d) * step;
  r.y += (dy / d) * step;
  return false;
}

/**
 * Call each frame. bike: { x, y } (metres; the moto follows you if you move). Returns events:
 * 'arrived' (the handover starts), 'delivered' (you get the fuel and pay), 'gone' (the moto is away).
 */
export function stepRescue(r, bike, dt) {
  const events = [];
  const step = (RESCUE.speedKmh / 3.6) * dt;
  r.eta = Math.max(0, (r.eta ?? 0) - dt);
  if (r.state === 'call') {
    if ((r.wait -= dt) <= 0) r.state = 'coming';
  } else if (r.state === 'coming') {
    // Along the roads, then the last part straight to you.
    const target = r.i < r.points.length ? r.points[r.i] : { x: bike.x, y: bike.y };
    if (r.i >= r.points.length && Math.hypot(bike.x - r.x, bike.y - r.y) <= RESCUE.handoverMetres) {
      r.state = 'handover';
      r.wait = RESCUE.handoverSeconds;
      events.push('arrived');
    } else if (moveTo(r, target, step) && r.i < r.points.length) r.i++;
  } else if (r.state === 'handover') {
    if ((r.wait -= dt) <= 0) {
      r.state = 'leaving';
      r.back = [...r.points].reverse();
      r.i = 0;
      events.push('delivered');
    }
  } else if (r.state === 'leaving') {
    if (r.i >= r.back.length || (moveTo(r, r.back[r.i], step) && ++r.i >= r.back.length) || r.i >= RESCUE.leavePoints) {
      r.state = 'gone';
      events.push('gone');
    }
  }
  return events;
}
