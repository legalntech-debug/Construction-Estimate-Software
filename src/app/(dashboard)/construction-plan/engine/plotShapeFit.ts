/**
 * plotShapeFit.ts  (v12)
 * ---------------------------------------------------------------------------------
 * Irregular / trapezoid / custom plot ke liye: floor plan plot ke SHAPE ke hisaab se aaye (rectangle nahi).
 *
 * Idea (architect jaisa):
 *   1) Plot polygon  -> setback + deewar ke baad INNER polygon (Q).
 *   2) Q ke andar sabse bada seedha (axis-aligned) rectangle = CORE.
 *      Core me poori purani (sahi) planning chalti hai -> regular plots ka kuch nahi badalta.
 *   3) Core ke bahar bachi hui wedge/slanted jagah (Q - core) ko core ke kinare wale kamron me jod dete hain
 *      (kamra badha hua, outer wall plot ki line par). Partition wall wedge tak extend hoti hai.
 *   4) Renderer outline (outer/inner polygon) se wall + clip banata hai.
 *
 * Sab kuch feet me; origin = outer polygon ka bounding-box top-left, y neeche ki taraf (front/road = neeche).
 */

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export interface PlotShapeFit {
  /** outer wall face polygon (setback ke baad), outer-bbox frame */
  outer: Pt[];
  /** clear (andar ki) polygon, INNER frame (= outer frame - wall) */
  inner: Pt[];
  /** outer bbox size (ft) */
  width: number;
  length: number;
  /** core rect, INNER frame */
  core: Rect;
  wall: number;
}

export interface RoomExtension { points: Pt[]; side: 'L' | 'R' | 'T' | 'B' }

const EPS = 1e-6;

export function polygonArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; s += p[i].x * p[j].y - p[j].x * p[i].y; }
  return s / 2;
}

export function bbox(p: Pt[]) {
  const xs = p.map(q => q.x), ys = p.map(q => q.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function normalizePolygon(p: Pt[]): Pt[] {
  const b = bbox(p);
  return p.map(q => ({ x: Number((q.x - b.minX).toFixed(4)), y: Number((q.y - b.minY).toFixed(4)) }));
}

/** CAD modal jaisa quad: bottom = A (front/road), top = B, left = C, right = D. Return [TL, TR, BR, BL] */
export function quadFromDims(A: number, B: number, C: number, D: number, slantB: 'MID' | 'LEFT' | 'RIGHT' = 'MID', angles?: { A?: number; B?: number; C?: number; D?: number } | null): Pt[] {
  const diff = B - A;
  let shL = -diff / 2, shR = diff / 2;
  if (slantB === 'LEFT') { shL = -diff; shR = 0; }
  else if (slantB === 'RIGHT') { shL = 0; shR = diff; }
  const BL = { x: -A / 2, y: C / 2 }, BR = { x: A / 2, y: C / 2 };
  let TL = { x: -A / 2 + shL, y: -C / 2 }, TR = { x: A / 2 + shR, y: -D / 2 };
  let BR2 = BR;
  // CAD modal jaisa hi side-angle (degree) rotation: A: BR about BL, B: TR about TL, C: TL about BL, D: TR about BR
  const rot = (pt: Pt, o: Pt, deg: number): Pt => {
    const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
    const dx = pt.x - o.x, dy = pt.y - o.y;
    return { x: o.x + (dx * cs - dy * sn), y: o.y + (dx * sn + dy * cs) };
  };
  if (angles) {
    if (angles.A) BR2 = rot(BR, BL, angles.A);
    if (angles.B) TR = rot(TR, TL, angles.B);
    if (angles.C) TL = rot(TL, BL, angles.C);
    if (angles.D) TR = rot(TR, BR2, angles.D);
  }
  return normalizePolygon([TL, TR, BR2, BL]);
}

export function isAxisRect(p: Pt[], tol = 0.05): boolean {
  if (p.length !== 4) return false;
  const b = bbox(p);
  return p.every(q => (Math.abs(q.x - b.minX) < tol || Math.abs(q.x - b.maxX) < tol) && (Math.abs(q.y - b.minY) < tol || Math.abs(q.y - b.maxY) < tol));
}

/** polygon ko har side se (front/rear/left/right) alag distance andar karo */
export function insetPolygon(poly: Pt[], d: { front: number; rear: number; left: number; right: number }): Pt[] {
  const n = poly.length;
  if (n < 3) return poly;
  const S = polygonArea(poly) >= 0 ? 1 : -1;
  type L = { p: Pt; dx: number; dy: number };
  const lines: L[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const inX = S > 0 ? -dy / len : dy / len;
    const inY = S > 0 ? dx / len : -dx / len;
    const ox = -inX, oy = -inY;                       // outward normal
    let dist = d.left;
    if (Math.abs(oy) >= Math.abs(ox)) dist = oy > 0 ? d.front : d.rear;
    else dist = ox < 0 ? d.left : d.right;
    lines.push({ p: { x: a.x + inX * dist, y: a.y + inY * dist }, dx: dx / len, dy: dy / len });
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const l0 = lines[(i + n - 1) % n], l1 = lines[i];
    const cr = l0.dx * l1.dy - l0.dy * l1.dx;
    if (Math.abs(cr) < 1e-9) { out.push({ x: l1.p.x, y: l1.p.y }); continue; }
    const t = ((l1.p.x - l0.p.x) * l1.dy - (l1.p.y - l0.p.y) * l1.dx) / cr;
    out.push({ x: l0.p.x + l0.dx * t, y: l0.p.y + l0.dy * t });
  }
  return out;
}

/** y par polygon ke andar x-interval [lo, hi] (min/max crossing) */
export function scanInterval(poly: Pt[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  if (xs.length < 2) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

/** polygon ke andar sabse bada axis-aligned rectangle (area max; barabar par zyada depth) */
export function maxInscribedRect(poly: Pt[], minW = 8, minH = 12): Rect | null {
  const b = bbox(poly);
  const step = 0.25;
  const ys: number[] = [];
  for (let y = b.minY + step / 2; y < b.maxY; y += step) ys.push(y);
  const xl: number[] = [], xr: number[] = [];
  for (const y of ys) {
    const it = scanInterval(poly, y);
    xl.push(it ? it[0] : Infinity); xr.push(it ? it[1] : -Infinity);
  }
  let best: Rect | null = null, bestScore = 0;
  const stride = 2; // 0.5 ft
  for (let k0 = 0; k0 < ys.length; k0 += stride) {
    let lo = -Infinity, hi = Infinity;
    for (let k1 = k0; k1 < ys.length; k1++) {
      lo = Math.max(lo, xl[k1]); hi = Math.min(hi, xr[k1]);
      if (hi - lo < minW) break;
      if ((k1 - k0 + 1) % stride !== 0) continue;
      const h = (k1 - k0 + 1) * step, w = hi - lo;
      if (h < minH) continue;
      const score = w * h + h * 0.001;
      if (score > bestScore) { bestScore = score; best = { x: lo, y: b.minY + k0 * step, w, h }; }
    }
  }
  if (!best) return null;
  const sn = (v: number) => Math.round(v * 4) / 4;
  const x0 = Math.ceil(best.x * 4) / 4, y0 = Math.ceil(best.y * 4) / 4;
  const x1 = Math.floor((best.x + best.w) * 4) / 4, y1 = Math.floor((best.y + best.h) * 4) / 4;
  void sn;
  return { x: x0, y: y0, w: Number((x1 - x0).toFixed(3)), h: Number((y1 - y0).toFixed(3)) };
}

/** Sutherland-Hodgman: polygon ko ek half-plane (a*x + b*y <= c) se kaato */
function clipHalf(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = a * p.x + b * p.y - c, fq = a * q.x + b * q.y - c;
    const pin = fp <= EPS, qin = fq <= EPS;
    if (pin) out.push(p);
    if (pin !== qin) {
      const t = fp / (fp - fq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}
const clipRect = (poly: Pt[], x0: number, y0: number, x1: number, y1: number): Pt[] => {
  let r = poly;
  r = clipHalf(r, -1, 0, -x0); if (r.length < 3) return [];
  r = clipHalf(r, 1, 0, x1); if (r.length < 3) return [];
  r = clipHalf(r, 0, -1, -y0); if (r.length < 3) return [];
  r = clipHalf(r, 0, 1, y1); if (r.length < 3) return [];
  return r;
};

/** plot polygon (+ optional explicit vertices) se fit banao. null => rectangle jaisa hi chalao */
export function buildPlotShapeFit(args: {
  dims: { A: number; B: number; C: number; D: number };
  shape: string;
  vertices?: Pt[] | null;
  slantB?: 'MID' | 'LEFT' | 'RIGHT';
  angles?: { A?: number; B?: number; C?: number; D?: number } | null;
  setbacks: { front: number; rear: number; left: number; right: number };
  wall: number;
}): PlotShapeFit | null {
  const shape = String(args.shape || '').toUpperCase();
  const simpleRect = shape === 'RECTANGLE' || shape === 'RECTANGULAR' || shape === 'SQUARE';
  let poly: Pt[] | null = null;
  if (args.vertices && args.vertices.length >= 3) {
    poly = normalizePolygon(args.vertices);
  } else if (!simpleRect) {
    poly = quadFromDims(args.dims.A, args.dims.B, args.dims.C, args.dims.D, args.slantB || 'MID', args.angles || null);
  }
  if (!poly || poly.length < 3 || isAxisRect(poly)) return null;

  const sb = args.setbacks;
  const outerRaw = insetPolygon(poly, { front: Math.max(0, sb.front), rear: Math.max(0, sb.rear), left: Math.max(0, sb.left), right: Math.max(0, sb.right) });
  if (Math.abs(polygonArea(outerRaw)) < 50) return null;
  const ob = bbox(outerRaw);
  const outer = outerRaw.map(p => ({ x: Number((p.x - ob.minX).toFixed(4)), y: Number((p.y - ob.minY).toFixed(4)) }));
  const innerOuterFrame = insetPolygon(outer, { front: args.wall, rear: args.wall, left: args.wall, right: args.wall });
  const inner = innerOuterFrame.map(p => ({ x: Number((p.x - args.wall).toFixed(4)), y: Number((p.y - args.wall).toFixed(4)) }));
  const core = maxInscribedRect(inner);
  if (!core) return null;
  return {
    outer, inner, width: Number((ob.maxX - ob.minX).toFixed(3)), length: Number((ob.maxY - ob.minY).toFixed(3)),
    core, wall: args.wall,
  };
}

/** boundary x-range of polygon at y (None => null) */
const edgeXAt = (poly: Pt[], y: number): [number, number] | null => scanInterval(poly, y);

/**
 * Core ke bahar ki jagah (inner polygon - core) core ke kinare wale kamron me jodo.
 * rooms core-frame se pehle hi INNER frame me shift ho chuke hote hain.
 * return: extWalls = wedge ke andar partition lines [x1,y1,x2,y2]
 */
export function extendRoomsToPolygon(
  rooms: any[], inner: Pt[], core: Rect,
): { extWalls: number[][]; extended: number } {
  const b = bbox(inner);
  const extWalls: number[][] = [];
  let extended = 0;
  const T = 0.12;
  const touches = (r: any, side: 'L' | 'R' | 'T' | 'B') => {
    if (side === 'L') return Math.abs(r.x - core.x) < T;
    if (side === 'R') return Math.abs(r.x + r.w - (core.x + core.w)) < T;
    if (side === 'T') return Math.abs(r.y - core.y) < T;
    return Math.abs(r.y + r.h - (core.y + core.h)) < T;
  };
  const area = (r: any) => r.w * r.h;

  const addExt = (room: any, pts: Pt[], side: 'L' | 'R' | 'T' | 'B') => {
    if (pts.length < 3 || Math.abs(polygonArea(pts)) < 0.5) return;
    room.extensions = room.extensions || [];
    room.extensions.push({ side, points: pts.map(p => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })) });
    extended++;
  };

  for (const side of ['L', 'R', 'T', 'B'] as const) {
    const horizontalStrip = side === 'L' || side === 'R';   // kamre y-interval se
    const cand = rooms.filter(r => touches(r, side));
    if (!cand.length) continue;
    // interval [a,b] har candidate ka (L/R: y-range, T/B: x-range)
    const lo0 = horizontalStrip ? core.y : core.x;
    const hi0 = horizontalStrip ? core.y + core.h : core.x + core.w;
    const iv = (r: any): [number, number] => horizontalStrip ? [r.y, r.y + r.h] : [r.x, r.x + r.w];
    const bps = Array.from(new Set([lo0, hi0, ...cand.flatMap(r => iv(r))].map(v => Number(v.toFixed(3)))))
      .filter(v => v >= lo0 - 1e-6 && v <= hi0 + 1e-6).sort((p, q) => p - q);
    type Seg = { a: number; b: number; room: any };
    const segs: Seg[] = [];
    for (let i = 0; i + 1 < bps.length; i++) {
      const m = (bps[i] + bps[i + 1]) / 2;
      const cov = cand.filter(r => { const [a, bb] = iv(r); return a <= m && bb >= m; });
      if (!cov.length) continue;
      cov.sort((p, q) => area(p) - area(q));          // sabse chhota (sub-room) pehle
      const pick = cov[0];
      const last = segs[segs.length - 1];
      if (last && last.room === pick && Math.abs(last.b - bps[i]) < 1e-6) last.b = bps[i + 1];
      else segs.push({ a: bps[i], b: bps[i + 1], room: pick });
    }
    if (!segs.length) continue;
    // pehla/aakhri segment polygon ke extreme tak jaye
    const ext0 = horizontalStrip ? b.minY : b.minX;
    const ext1 = horizontalStrip ? b.maxY : b.maxX;
    segs.forEach((s, si) => {
      const stretch = horizontalStrip;      // L/R: corner wedge bhi le lo; T/B: sirf core ki x-range
      const a0 = (stretch && si === 0) ? Math.min(s.a, ext0) : s.a;
      const a1 = (stretch && si === segs.length - 1) ? Math.max(s.b, ext1) : s.b;
      let piece: Pt[] = [];
      if (side === 'L') piece = clipRect(inner, b.minX - 1, a0, core.x, a1);
      else if (side === 'R') piece = clipRect(inner, core.x + core.w, a0, b.maxX + 1, a1);
      else if (side === 'T') piece = clipRect(inner, a0, b.minY - 1, a1, core.y);
      else piece = clipRect(inner, a0, core.y + core.h, a1, b.maxY + 1);
      addExt(s.room, piece, side);
      // interior partition (do segments ke beech) wedge me extend
      if (si > 0) {
        const v = s.a;
        if (side === 'L') { const it = edgeXAt(inner, v); if (it) extWalls.push([it[0], v, core.x, v]); }
        else if (side === 'R') { const it = edgeXAt(inner, v); if (it) extWalls.push([core.x + core.w, v, it[1], v]); }
        else {
          // vertical partition: polygon ke top/bottom boundary tak
          const ys: number[] = [];
          for (let i = 0; i < inner.length; i++) {
            const p = inner[i], q = inner[(i + 1) % inner.length];
            if ((p.x <= v && q.x > v) || (q.x <= v && p.x > v)) ys.push(p.y + ((v - p.x) / (q.x - p.x)) * (q.y - p.y));
          }
          if (ys.length) {
            if (side === 'T') extWalls.push([v, Math.min(...ys), v, core.y]);
            else extWalls.push([v, core.y + core.h, v, Math.max(...ys)]);
          }
        }
      }
    });
  }
  return { extWalls, extended };
}
