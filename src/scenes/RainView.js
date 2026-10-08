import { EVENTS } from '../config.js';

// Rain on a rainy day: thin streaks that fall over the whole view. The streaks are whole pixels
// (fillRect at whole coordinates), so the camera zoom keeps them sharp.

export class RainView {
  constructor(scene) {
    const r = EVENTS.rain;
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(1e7).setVisible(false);
    this.g.noAmbient = true; // the night tint does not change the rain
    // Each drop: a place on the view (0..1) and a length in pixels.
    this.drops = Array.from({ length: r.drops }, () => ({ u: Math.random(), v: Math.random(), len: 3 + Math.floor(Math.random() * 4) }));
    this.on = false;
  }

  setRain(on) {
    this.on = on;
    this.g.setVisible(on);
    if (!on) this.g.clear();
  }

  /** view: the camera worldView. dt in seconds. */
  update(view, dt) {
    if (!this.on) return;
    const r = EVENTS.rain, g = this.g;
    g.clear();
    g.fillStyle(r.dropColour, r.dropAlpha);
    const fall = (r.fallPxPerSecond * dt) / view.height;
    for (const d of this.drops) {
      d.v += fall * (0.8 + d.len / 15);
      d.u -= fall * r.slantPx * (view.height / view.width);
      if (d.v > 1) { d.v -= 1; d.u = Math.random(); }
      if (d.u < 0) d.u += 1;
      const x = Math.floor(view.x + d.u * view.width), y = Math.floor(view.y + d.v * view.height);
      // A slanted streak: steps of 1 px, one to the left every few pixels down.
      for (let i = 0; i < d.len; i++) g.fillRect(x - Math.floor(i * r.slantPx), y + i, 1, 1);
    }
  }

  destroy() {
    this.g.destroy();
  }
}
