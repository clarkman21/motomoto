import { COLOURS, MINIMAP, WORLD } from '../config.js';
import { drawMinimap, minimapPoint, minimapDirection, districtLabels } from '../world/minimap.js';
import { jobTarget } from '../sim/jobs.js';
import { milestoneReady } from '../sim/levels.js';
import { textBit } from '../world/garage-sprites.js';
import { FUEL_BRAND } from '../world/sprites.js';
import { addCanvasTexture } from './textures.js';
import { UI, drawWindow, retroLabel } from './retro-ui.js';

// The minimap in the lower left corner of the HUD, like in GTA: a zoomed view of the area
// around you that moves as you ride. It does not turn (up on the map is up on the screen).
// It is part of the retro HUD: it lives in the HUD container, in virtual pixels, and one map
// pixel is one virtual pixel (big, sharp pixels).
// It shows the district names, the stations for your bike (SP fuel or swap), the garages, the
// Ampersand showroom, the job target and you. Closed districts are striped, with padlocks.
// Key M (or the Settings menu) shows or hides it.

const FUEL = COLOURS.spBlue; // SP: a blue badge with yellow letters
const GARAGE = 0xe07a2a; // orange, so it is not like the blue SP badge
const JOB_PICKUP = 0x44bc9d;
const PAD = 4;
const LEGEND_H = 11;

export class MinimapView {
  /** scene: the HUD scene (it has k, the pixel scale). ui: the HUD container (virtual pixels). */
  constructor(scene, ui) {
    this.scene = scene;
    this.ride = scene.ride;
    this.ui = ui;
    this.panel = scene.add.graphics();
    // Everything on the map is in one container (in map pixels). The container moves, and a
    // mask (in screen pixels) cuts it to the window.
    this.map = scene.add.container(0, 0);
    this.image = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.icons = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.labels = [];
    this.map.add([this.image, this.icons]);
    this.maskShape = scene.make.graphics({}, false);
    this.map.setMask(this.maskShape.createGeometryMask());
    this.legend = [0, 1, 2].map(() => retroLabel(scene, 0, 0, '', UI.dim));
    this.legendIcons = scene.add.graphics();
    ui.add([this.panel, this.map, this.legendIcons, ...this.legend]);
    this.key = null;
  }

  /** Place the map. x, bottom: the lower left corner, in virtual pixels. */
  layout(x, bottom) {
    this.f = MINIMAP.pxPerTile;
    const w = MINIMAP.viewWidth, h = MINIMAP.viewHeight;
    this.box = { x, y: bottom - h - 2 * PAD - LEGEND_H, w: w + 2 * PAD, h: h + 2 * PAD + LEGEND_H };
    this.view = { x: x + PAD, y: this.box.y + PAD, w, h };
    const g = this.panel.clear();
    drawWindow(g, this.box.x, this.box.y, this.box.w, this.box.h);
    g.fillStyle(0x101420, 1).fillRect(this.view.x, this.view.y, w, h); // outside the city: dark
    g.fillStyle(0x000000, 1).fillRect(this.view.x - 1, this.view.y - 1, w + 2, 1).fillRect(this.view.x - 1, this.view.y + h, w + 2, 1)
      .fillRect(this.view.x - 1, this.view.y, 1, h).fillRect(this.view.x + w, this.view.y, 1, h);
    const k = this.scene.k;
    this.maskShape.clear().fillStyle(0xffffff).fillRect(this.view.x * k, this.view.y * k, w * k, h * k);
    this.key = null; // draw the map again
  }

  #rebuild() {
    const ride = this.ride, world = ride.world, f = this.f;
    const closed = world.closed ? [...world.closed].join('-') : '';
    this.key = `${closed}|${f}|${ride.bike.type}`;
    const tex = `minimap-${f}-${closed || 'all'}`;
    if (!this.scene.textures.exists(tex)) addCanvasTexture(this.scene, tex, drawMinimap(world, f));
    this.image.setTexture(tex);
    // District names in the pixel font: white when open, grey when closed (the map has padlocks there).
    for (const l of this.labels) l.destroy();
    this.labels = districtLabels(world, f).map((d) => retroLabel(this.scene, Math.round(d.x), Math.round(d.y), d.name, d.open ? UI.white : UI.grey).setOrigin(0.5));
    // Stations for your bike (petrol: SP fuel; electric: swap), the garages and the showroom (open districts only).
    const g = this.icons.clear();
    const electric = ride.bike.type === 'electric';
    for (const tag of [electric ? 'swap' : 'fuel', 'garage', 'office']) {
      for (const p of world.placesWithTag(tag)) {
        if (world.isClosedTile(world.tile(Math.floor(p.x), Math.floor(p.y)))) continue;
        const m = minimapPoint(world, f, p.x * WORLD.tileMetres, p.y * WORLD.tileMetres);
        const x0 = Math.round(m.x), y0 = Math.round(m.y);
        if (tag === 'fuel') drawSpBadge(g, x0, y0);
        else if (tag === 'office') drawAmpersandBadge(g, x0, y0);
        else square(g, x0, y0, tag === 'swap' ? COLOURS.ampersandYellow : GARAGE);
      }
    }
    this.map.add([...this.labels, this.marks]);
    // Legend under the map: a small mark and a word for each.
    const ly = this.view.y + this.view.h + 2;
    const lg = this.legendIcons.clear();
    const items = [[electric ? 'swap' : 'fuel', electric ? 'SWAP' : 'SP'], ['garage', 'GARAGE'], ['job', 'JOB']];
    let x = this.view.x + 5;
    items.forEach(([kind, word], i) => {
      if (kind === 'fuel') drawSpBadge(lg, x, ly + 4);
      else square(lg, x, ly + 4, kind === 'swap' ? COLOURS.ampersandYellow : kind === 'garage' ? GARAGE : JOB_PICKUP);
      this.legend[i].setText(word).setPosition(x + 7, ly);
      x += 7 + this.legend[i].width + 7;
    });
  }

  #setVisible(v) {
    for (const o of [this.panel, this.map, ...this.legend, this.legendIcons]) o.setVisible(v);
  }

  update(time) {
    const ride = this.ride;
    const show = ride.showMap !== false;
    this.#setVisible(show);
    if (!show) return;
    const world = ride.world, f = this.f, v = this.view;
    const key = `${world.closed ? [...world.closed].join('-') : ''}|${f}|${ride.bike.type}`;
    if (key !== this.key) this.#rebuild();
    // Keep you in the middle of the window: move the map (whole pixels, so it stays sharp).
    const b = ride.bike;
    const p = minimapPoint(world, f, b.x, b.y);
    const ox = Math.round(p.x - v.w / 2), oy = Math.round(p.y - v.h / 2);
    this.map.setPosition(v.x - ox, v.y - oy);
    // Show a name only when all of it is in the window.
    for (const l of this.labels) {
      const hw = l.width / 2, hh = l.height / 2;
      l.setVisible(l.x - hw >= ox && l.x + hw <= ox + v.w && l.y - hh >= oy && l.y + hh <= oy + v.h);
    }
    const g = this.marks.clear();
    // The target: the job (green: pickup, white: drop off), or the showroom when you can buy the
    // electric moto. Out of the window: at the edge, in its direction.
    const job = ride.board?.active;
    let target = null, colour = 0xffffff;
    if (job) {
      const t = jobTarget(job);
      target = minimapPoint(world, f, t.x * WORLD.tileMetres, t.y * WORLD.tileMetres);
      colour = job.stage === 'toPickup' ? JOB_PICKUP : 0xffffff;
    } else if (ride.level?.buyAt === 'office' && milestoneReady(ride.wallet)) {
      const o = world.placesWithTag('office')[0];
      if (o) target = minimapPoint(world, f, o.x * WORLD.tileMetres, o.y * WORLD.tileMetres);
      colour = COLOURS.ampersandYellow;
    }
    // A hired rider who waits for help: a blue mark (drawn first, so the job target stays on top).
    const help = ride.helpWait?.vehicle;
    const marks = [];
    if (help) marks.push({ at: minimapPoint(world, f, help.x, help.y), colour: 0x3a7fd0 });
    if (target) marks.push({ at: target, colour });
    for (const m of marks) {
      const e = 3;
      const cx = Math.round(Math.max(ox + e, Math.min(ox + v.w - e, m.at.x))), cy = Math.round(Math.max(oy + e, Math.min(oy + v.h - e, m.at.y)));
      const out = cx !== Math.round(m.at.x) || cy !== Math.round(m.at.y);
      const r = out ? 1.5 : 2 + Math.round((Math.sin(time / 160) + 1) / 2);
      g.fillStyle(0x000000, 1).fillCircle(cx, cy, r + 1).fillStyle(m.colour, 1).fillCircle(cx, cy, r);
    }
    // You: a white arrow in the direction of the bike.
    const d = minimapDirection(b.heading);
    const n = { x: -d.y, y: d.x };
    const tip = { x: p.x + d.x * 4, y: p.y + d.y * 4 };
    const l = { x: p.x - d.x * 2 + n.x * 3, y: p.y - d.y * 2 + n.y * 3 };
    const rr = { x: p.x - d.x * 2 - n.x * 3, y: p.y - d.y * 2 - n.y * 3 };
    g.lineStyle(2, 0x000000, 1).strokeTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
    g.fillStyle(0xffffff, 1).fillTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
  }
}

/** A small square mark with a black edge. (x, y): the centre. */
function square(g, x, y, rgb) {
  g.fillStyle(0x000000, 1).fillRect(x - 2, y - 2, 5, 5).fillStyle(rgb, 1).fillRect(x - 1, y - 1, 3, 3);
}

/** The Ampersand showroom: a black badge with a yellow "&". (x, y): the centre. */
function drawAmpersandBadge(g, x, y) {
  g.fillStyle(COLOURS.ampersandYellow, 1).fillRect(x - 3, y - 4, 7, 9).fillStyle(0x0a0a0a, 1).fillRect(x - 2, y - 3, 5, 7).fillStyle(COLOURS.ampersandYellow, 1);
  for (let py = 0; py < 5; py++) for (let px = 0; px < 3; px++) if (textBit('&', px, py)) g.fillRect(x - 1 + px, y - 2 + py, 1, 1);
}

/** A small blue badge with "SP" in yellow, like the sign at the station. (x, y): the centre. */
function drawSpBadge(g, x, y) {
  const x0 = x - 4, y0 = y - 3;
  g.fillStyle(0x000000, 1).fillRect(x0 - 1, y0 - 1, 11, 9).fillStyle(FUEL, 1).fillRect(x0, y0, 9, 7).fillStyle(COLOURS.spYellow, 1);
  for (let py = 0; py < 5; py++) for (let px = 0; px < 7; px++) if (textBit(FUEL_BRAND, px, py)) g.fillRect(x0 + 1 + px, y0 + 1 + py, 1, 1);
}
