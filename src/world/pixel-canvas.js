// A small software rasterizer that draws hard edged pixel art into an RGBA
// buffer. It has no browser dependency, so tests can run it in Node.
// Coordinates are internal screen pixels. (ox, oy) is the screen position of
// the buffer's top left pixel.

export class PixelCanvas {
  constructor(width, height, ox = 0, oy = 0) {
    this.width = Math.max(1, Math.ceil(width));
    this.height = Math.max(1, Math.ceil(height));
    this.ox = ox;
    this.oy = oy;
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
  }

  setPixel(px, py, rgb, alpha = 255) {
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const i = (py * this.width + px) * 4;
    this.data[i] = (rgb >> 16) & 255;
    this.data[i + 1] = (rgb >> 8) & 255;
    this.data[i + 2] = rgb & 255;
    this.data[i + 3] = alpha;
  }

  /** Set a pixel from screen coordinates. */
  plot(sx, sy, rgb, alpha = 255) {
    this.setPixel(Math.floor(sx - this.ox), Math.floor(sy - this.oy), rgb, alpha);
  }

  alphaAt(px, py) {
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return 0;
    return this.data[(py * this.width + px) * 4 + 3];
  }

  /**
   * Fill a triangle. Each vertex is { x, y, u, v } with screen x, y and two
   * free attributes. shade(u, v, px, py) returns 0xRRGGBB, or -1 to skip the pixel.
   */
  fillTri(a, b, c, shade) {
    const ax = a.x - this.ox, ay = a.y - this.oy;
    const bx = b.x - this.ox, by = b.y - this.oy;
    const cx = c.x - this.ox, cy = c.y - this.oy;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) return;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(ay, by, cy)));
    const eps = -1e-7;
    for (let py = minY; py <= maxY; py++) {
      const y = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const x = px + 0.5;
        const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area;
        const w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < eps || w1 < eps || w2 < eps) continue;
        const u = w0 * a.u + w1 * b.u + w2 * c.u;
        const v = w0 * a.v + w1 * b.v + w2 * c.v;
        const rgb = shade(u, v, px, py);
        if (rgb >= 0) this.setPixel(px, py, rgb);
      }
    }
  }

  /** Fill a quad p0 p1 p2 p3 (in order around the edge) as two triangles. */
  fillQuad(p0, p1, p2, p3, shade) {
    this.fillTri(p0, p1, p2, shade);
    this.fillTri(p0, p2, p3, shade);
  }

  /** Fill a convex polygon of screen points with one colour. */
  fillPoly(points, rgb) {
    for (let i = 1; i < points.length - 1; i++) {
      this.fillTri(
        { ...points[0], u: 0, v: 0 },
        { ...points[i], u: 0, v: 0 },
        { ...points[i + 1], u: 0, v: 0 },
        () => rgb,
      );
    }
  }

  /** Filled disc in screen coordinates. */
  fillDisc(sx, sy, r, rgb) {
    const x0 = Math.floor(sx - r), x1 = Math.ceil(sx + r);
    const y0 = Math.floor(sy - r), y1 = Math.ceil(sy + r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2 <= r * r) this.plot(x, y, rgb);
      }
    }
  }

  /** Thick line made of discs. */
  line(x0, y0, x1, y1, thickness, rgb) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.fillDisc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness / 2, rgb);
    }
  }

  /** Draw a 1 px outline around all opaque pixels (pixel art style). */
  outline(rgb) {
    const marks = [];
    for (let py = 0; py < this.height; py++) {
      for (let px = 0; px < this.width; px++) {
        if (this.alphaAt(px, py)) continue;
        if (this.alphaAt(px - 1, py) || this.alphaAt(px + 1, py) || this.alphaAt(px, py - 1) || this.alphaAt(px, py + 1)) {
          marks.push(px, py);
        }
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.setPixel(marks[i], marks[i + 1], rgb);
  }
}

/** Multiply an 0xRRGGBB colour by a brightness factor. */
export function shadeColour(rgb, k) {
  const r = Math.min(255, Math.round(((rgb >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((rgb >> 8) & 255) * k));
  const b = Math.min(255, Math.round((rgb & 255) * k));
  return (r << 16) | (g << 8) | b;
}

/** Deterministic hash of integer coordinates to 0..1, for pixel noise. */
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
