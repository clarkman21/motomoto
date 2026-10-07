import { COLOURS, MINIMAP, WORLD } from '../config.js';
import { drawMinimap, minimapPoint, minimapDirection, districtLabels } from '../world/minimap.js';
import { jobTarget } from '../sim/jobs.js';
import { textBit } from '../world/garage-sprites.js';
import { FUEL_BRAND } from '../world/sprites.js';
import { addCanvasTexture } from './textures.js';

// The minimap in the lower left corner of the HUD, like in GTA: a zoomed view of the area
// around you that moves as you ride. It does not turn (up on the map is up on the screen).
// It shows the district names, the stations for your bike (SP fuel or swap), the garages,
// the job target and you. Closed districts are striped, with padlocks.
// Key M (or the Settings menu) shows or hides it.

const FONT = '"Barlow Condensed", "Instrument Sans", system-ui, sans-serif';
const FUEL = COLOURS.spBlue; // SP: a blue badge with yellow letters
const GARAGE = 0xe07a2a; // orange, so it is not like the blue SP badge
const JOB_PICKUP = 0x44bc9d;
const PAD = 6;

export class MinimapView {
  constructor(scene) {
    this.scene = scene;
    this.ride = scene.ride;
    this.panel = scene.add.graphics();
    // Everything on the map is in one container (in map pixels). The container moves, and a
    // mask cuts it to the window.
    this.map = scene.add.container(0, 0);
    this.image = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.icons = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.labels = [];
    this.map.add([this.image, this.icons]);
    this.maskShape = scene.make.graphics({}, false);
    this.map.setMask(this.maskShape.createGeometryMask());
    this.frame = scene.add.graphics();
    this.legend = [0, 1, 2].map(() => scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#d8d8d8' }));
    this.legendIcons = scene.add.graphics();
    this.key = null;
  }

  /** Place the map. x, bottom: the lower left corner. s: the HUD scale. */
  layout(x, bottom, s) {
    this.f = s < 1 ? MINIMAP.pxPerTileSmall : MINIMAP.pxPerTile;
    this.s = s;
    const w = Math.round(MINIMAP.viewWidth * s), h = Math.round(MINIMAP.viewHeight * s);
    const legendH = Math.round(18 * s);
    this.box = { x, y: bottom - h - 2 * PAD - legendH, w: w + 2 * PAD, h: h + 2 * PAD + legendH };
    this.view = { x: x + PAD, y: this.box.y + PAD, w, h };
    this.panel.clear().fillStyle(0x000000, 0.62).fillRoundedRect(this.box.x, this.box.y, this.box.w, this.box.h, 8 * s);
    this.panel.fillStyle(0x161a1e, 1).fillRect(this.view.x, this.view.y, w, h); // outside the city: dark
    this.maskShape.clear().fillStyle(0xffffff).fillRect(this.view.x, this.view.y, w, h);
    this.frame.clear().lineStyle(1, 0x5a5e62, 1).strokeRect(this.view.x - 0.5, this.view.y - 0.5, w + 1, h + 1);
    for (const t of this.legend) t.setFontSize(`${Math.round(13 * s)}px`);
    this.key = null; // draw the map again at the new size
  }

  #rebuild() {
    const ride = this.ride, world = ride.world, f = this.f;
    const closed = world.closed ? [...world.closed].join('-') : '';
    this.key = `${closed}|${f}|${ride.bike.type}`;
    const tex = `minimap-${f}-${closed || 'all'}`;
    if (!this.scene.textures.exists(tex)) addCanvasTexture(this.scene, tex, drawMinimap(world, f));
    this.image.setTexture(tex);
    // District names: white when open, grey when closed (the map has padlocks there).
    for (const l of this.labels) l.destroy();
    const g = this.icons.clear();
    this.labels = districtLabels(world, f).map((d) => {
      const t = this.scene.add.text(Math.round(d.x), Math.round(d.y), d.name, {
        fontFamily: FONT, fontSize: `${Math.round(12 * this.s)}px`, fontStyle: '600',
        color: d.open ? '#ffffff' : '#9a9a9a', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      return t;
    });
    // Stations for your bike (petrol: SP fuel; electric: swap) and the garages, in open districts only.
    const electric = ride.bike.type === 'electric';
    for (const tag of [electric ? 'swap' : 'fuel', 'garage']) {
      for (const p of world.placesWithTag(tag)) {
        if (world.isClosedTile(world.tile(Math.floor(p.x), Math.floor(p.y)))) continue;
        const m = minimapPoint(world, f, p.x * WORLD.tileMetres, p.y * WORLD.tileMetres);
        const x0 = Math.round(m.x), y0 = Math.round(m.y);
        if (tag === 'fuel') drawSpBadge(g, x0, y0);
        else g.fillStyle(0x000000, 1).fillRect(x0 - 3, y0 - 3, 7, 7).fillStyle(tag === 'swap' ? COLOURS.ampersandYellow : GARAGE, 1).fillRect(x0 - 2, y0 - 2, 5, 5);
      }
    }
    this.map.add([...this.labels, this.marks]);
    // Legend under the map: a small mark and a word for each.
    const ly = this.view.y + this.view.h + Math.round(4 * this.s);
    const lg = this.legendIcons.clear();
    const items = [[electric ? 'swap' : 'fuel', electric ? 'Swap' : 'SP fuel'], ['garage', 'Garage'], ['job', 'Job']];
    let x = this.view.x + 6;
    items.forEach(([kind, word], i) => {
      if (kind === 'fuel') drawSpBadge(lg, x, ly + 7);
      else lg.fillStyle(0x000000, 1).fillRect(x - 3, ly + 4, 7, 7).fillStyle(kind === 'swap' ? COLOURS.ampersandYellow : kind === 'garage' ? GARAGE : JOB_PICKUP, 1).fillRect(x - 2, ly + 5, 5, 5);
      this.legend[i].setText(word).setPosition(x + 8, ly);
      x += 8 + this.legend[i].width + 14 * this.s;
    });
  }

  #setVisible(v) {
    for (const o of [this.panel, this.map, this.frame, ...this.legend, this.legendIcons]) o.setVisible(v);
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
    // The job target: green for the pickup, white for the drop off. Out of the window: at the
    // edge, in its direction.
    const job = ride.board?.active;
    if (job) {
      const t = jobTarget(job);
      const m = minimapPoint(world, f, t.x * WORLD.tileMetres, t.y * WORLD.tileMetres);
      const e = 5;
      const cx = Math.max(ox + e, Math.min(ox + v.w - e, m.x)), cy = Math.max(oy + e, Math.min(oy + v.h - e, m.y));
      const r = cx !== m.x || cy !== m.y ? 2.5 : 3 + Math.sin(time / 160);
      g.fillStyle(0x000000, 1).fillCircle(cx, cy, r + 1.5).fillStyle(job.stage === 'toPickup' ? JOB_PICKUP : 0xffffff, 1).fillCircle(cx, cy, r);
    }
    // You: a white arrow in the direction of the bike.
    const d = minimapDirection(b.heading);
    const n = { x: -d.y, y: d.x };
    const tip = { x: p.x + d.x * 6, y: p.y + d.y * 6 };
    const l = { x: p.x - d.x * 3 + n.x * 4, y: p.y - d.y * 3 + n.y * 4 };
    const rr = { x: p.x - d.x * 3 - n.x * 4, y: p.y - d.y * 3 - n.y * 4 };
    g.lineStyle(3, 0x000000, 1).strokeTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
    g.fillStyle(0xffffff, 1).fillTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
  }
}

/** A small blue badge with "SP" in yellow, like the sign at the station. (x, y): the centre. */
function drawSpBadge(g, x, y) {
  const x0 = x - 5, y0 = y - 4;
  g.fillStyle(0x000000, 1).fillRect(x0 - 1, y0 - 1, 11, 9).fillStyle(FUEL, 1).fillRect(x0, y0, 9, 7).fillStyle(COLOURS.spYellow, 1);
  for (let py = 0; py < 5; py++) for (let px = 0; px < 7; px++) if (textBit(FUEL_BRAND, px, py)) g.fillRect(x0 + 1 + px, y0 + 1 + py, 1, 1);
}
