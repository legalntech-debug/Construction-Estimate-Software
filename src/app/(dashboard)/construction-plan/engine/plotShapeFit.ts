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

/**
 * v27: L-SHAPE plot polygon. UI blueprint: A = front (road) width, B = right (chhota) side, C = top (rear) width,
 * D = left (poori) height, E = A - C (inner step), F = D - B (inner vertical). Front bottom me (y neeche).
 * Notch (kata hua hissa): B & C diye ho to (A-C) x (D-B), warna E x F, warna A/3 x D/3.
 * TYPE 1 = front-left cut, TYPE 2 = front-right, TYPE 3 = rear-left, baaki (TYPE 4/5/6/plain) = rear-right (base).
 */
export function lShapeFromDims(dims: { A?: any; B?: any; C?: any; D?: any; E?: any; F?: any }, shape: string): { poly: Pt[]; W: number; H: number; area: number; notchW: number; notchH: number } | null {
  const n = (v: any) => Number(v) || 0;
  const A = n(dims.A), D = n(dims.D) || n(dims.C);
  if (!(A > 1 && D > 1)) return null;
  let nw = 0, nh = 0;
  if (n(dims.B) > 0 && n(dims.C) > 0 && n(dims.C) < A && n(dims.B) < D && n(dims.D) > 0) { nw = A - n(dims.C); nh = D - n(dims.B); }
  else if (n(dims.E) > 0 && n(dims.F) > 0) { nw = n(dims.E); nh = n(dims.F); }
  else { nw = A / 3; nh = D / 3; }
  nw = Math.min(Math.max(nw, 1), A - 1); nh = Math.min(Math.max(nh, 1), D - 1);
  let pts: Pt[] = [{ x: 0, y: D }, { x: A, y: D }, { x: A, y: nh }, { x: A - nw, y: nh }, { x: A - nw, y: 0 }, { x: 0, y: 0 }];   // notch rear-right
  const t = String(shape || '').toUpperCase();
  const flipX = t.includes('TYPE 1') || t.includes('TYPE 3');
  const flipY = t.includes('TYPE 1') || t.includes('TYPE 2');
  pts = pts.map((p) => ({ x: flipX ? A - p.x : p.x, y: flipY ? D - p.y : p.y }));
  if (flipX !== flipY) pts = pts.reverse();
  const poly = normalizePolygon(pts);
  return { poly, W: A, H: D, area: Math.abs(polygonArea(poly)), notchW: nw, notchH: nh };
}

/**
 * v26: irregular plot par user ka SPECIFIC area -> rectangular (outer) dims. Core (plot ke andar ka max rectangle) ke
 * aspect ke hisaab se; core se bada nahi jaata. cw/ch = core ka OUTER size (core + 2 wall).
 */
export function rectForArea(area: number, cw: number, ch: number): { w: number; l: number; clamped: boolean } {
  const a = Math.max(1, area), W0 = Math.max(1, cw), H0 = Math.max(1, ch);
  let w = Math.sqrt((a * W0) / H0), l = a / w;
  if (w > W0) { w = W0; l = a / w; }
  if (l > H0) { l = H0; w = a / l; }
  const clamped = w > W0 + 1e-6 || l > H0 + 1e-6 || a > W0 * H0 + 1e-6;
  w = Math.min(w, W0); l = Math.min(l, H0);
  return { w: Number(w.toFixed(2)), l: Number(l.toFixed(2)), clamped };
}

/** v26: base fit ke core ke andar (core ke top-left se) outerW x outerL ka RECTANGULAR floor fit (polygon = rectangle) */
export function makeRectFit(base: PlotShapeFit, outerW: number, outerL: number, alignBottom = false): PlotShapeFit {
  const wall = base.wall;
  const iw = Math.max(1, Math.min(outerW - 2 * wall, base.core.w));
  const il = Math.max(1, Math.min(outerL - 2 * wall, base.core.h));
  const X0 = base.core.x, Y0 = alignBottom ? base.core.y + base.core.h - il : base.core.y;   // L: rectangle road (neeche) se lagi rahe
  const inner: Pt[] = [{ x: X0, y: Y0 }, { x: X0 + iw, y: Y0 }, { x: X0 + iw, y: Y0 + il }, { x: X0, y: Y0 + il }];
  const outer: Pt[] = [{ x: X0, y: Y0 }, { x: X0 + iw + 2 * wall, y: Y0 }, { x: X0 + iw + 2 * wall, y: Y0 + il + 2 * wall }, { x: X0, y: Y0 + il + 2 * wall }];
  return { outer, inner, width: Number((iw + 2 * wall).toFixed(3)), length: Number((il + 2 * wall).toFixed(3)), core: { x: X0, y: Y0, w: iw, h: il }, wall };
}

/**
 * v23: IRREGULAR plot - 3 sides di ho to 4th side auto.  A=front(bottom), B=back(top), C=left, D=right.
 * Side <= 0 / blank = missing. Sirf EK side missing ho tab calculate hota hai
 * (assumption: front horizontal, back horizontal, left vertical => right-angle trapezoid).
 * Return: poore 4 sides + auto = jis side ko calculate kiya.
 */
export function completeQuadSides(A: number, B: number, C: number, D: number): { A: number; B: number; C: number; D: number; auto: 'A' | 'B' | 'C' | 'D' | null } {
  const v = { A: Number(A) || 0, B: Number(B) || 0, C: Number(C) || 0, D: Number(D) || 0 };
  const miss = (['A', 'B', 'C', 'D'] as const).filter((k) => !(v[k] > 0));
  if (miss.length !== 1) {
    // purana fallback: opposite side ke barabar
    return { A: v.A, B: v.B > 0 ? v.B : v.A, C: v.C, D: v.D > 0 ? v.D : v.C, auto: null };
  }
  const k = miss[0];
  const r2 = (n: number) => Number(n.toFixed(2));
  const sq = (n: number) => Math.sqrt(Math.max(0, n));
  if (k === 'D') v.D = r2(Math.hypot(v.B - v.A, v.C));
  else if (k === 'C') v.C = r2(v.D > Math.abs(v.B - v.A) ? sq(v.D * v.D - (v.B - v.A) ** 2) : v.D);
  else if (k === 'B') v.B = r2(v.D >= v.C ? v.A + sq(v.D * v.D - v.C * v.C) : v.A);
  else { const t = sq(v.D * v.D - v.C * v.C); v.A = r2(v.B - t > 0.5 ? v.B - t : v.B + t); }
  return { ...v, auto: k };
}

function circleIntersect(p0: Pt, r0: number, p1: Pt, r1: number): Pt[] | null {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9) return null;
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = p0.x + (a * dx) / d, my = p0.y + (a * dy) / d;
  return [{ x: mx + (h * dy) / d, y: my - (h * dx) / d }, { x: mx - (h * dy) / d, y: my + (h * dx) / d }];
}

/**
 * v23: chaaro sides ki ASLI length se quad (front horizontal). Return [TL, TR, BR, BL] (y neeche), ya null.
 *  1) front/back parallel (trapezoid) ban sakta ho to wahi (sab 4 sides exact)
 *  2) warna left (slant LEFT me right) side vertical rakh kar baaki sides exact
 */
export function quadFromSides(A: number, B: number, C: number, D: number, slant: 'MID' | 'LEFT' | 'RIGHT' = 'MID'): Pt[] | null {
  if (!(A > 0 && B > 0 && C > 0 && D > 0)) return null;
  const eps = 1e-6, diff = A - B;
  let TL: Pt, TR: Pt; const BL = { x: 0, y: 0 }, BR = { x: A, y: 0 };
  if (Math.abs(diff) < eps) {
    if (Math.abs(C - D) < eps) return normalizePolygon([{ x: 0, y: -C }, { x: A, y: -C }, { x: A, y: 0 }, { x: 0, y: 0 }]);
  } else {
    const x1 = (C * C - D * D + diff * diff) / (2 * diff);
    const h2 = C * C - x1 * x1;
    if (h2 > eps) { const h = Math.sqrt(h2); return normalizePolygon([{ x: x1, y: h }, { x: x1 + B, y: h }, BR, BL].map((q) => ({ x: q.x, y: -q.y }))); }
  }
  if (slant === 'LEFT') {
    TR = { x: A, y: D };
    const c = circleIntersect(BL, C, TR, B)?.filter((q) => q.y > 0);
    if (!c || !c.length) return null;
    TL = c.reduce((m, q) => (q.x < m.x ? q : m));
  } else {
    TL = { x: 0, y: C };
    const c = circleIntersect(BR, D, TL, B)?.filter((q) => q.y > 0);
    if (!c || !c.length) return null;
    TR = c.reduce((m, q) => (q.x > m.x ? q : m));
  }
  return normalizePolygon([TL, TR, BR, BL].map((q) => ({ x: q.x, y: -q.y })));
}

/** CAD modal jaisa quad: bottom = A (front/road), top = B, left = C, right = D. Return [TL, TR, BR, BL] */
export function quadFromDims(A: number, B: number, C: number, D: number, slantB: 'MID' | 'LEFT' | 'RIGHT' = 'MID', angles?: { A?: number; B?: number; C?: number; D?: number } | null): Pt[] {
  // v23: DEG (angle) nahi diya -> chaaro sides ki asli length wala geometry
  if (!(angles && (angles.A || angles.B || angles.C || angles.D))) {
    const q = quadFromSides(A, B, C, D, slantB);
    if (q) return q;
  }
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
export function maxInscribedRect(poly: Pt[], minW = 8, minH = 12, touchBottom = false): Rect | null {
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
      // v28: road-touching core (L-shape) -> rectangle polygon ke sabse neeche (road face) tak jaana chahiye
      if (touchBottom) { if (k1 !== ys.length - 1) continue; }
      else if ((k1 - k0 + 1) % stride !== 0) continue;
      const h = (k1 - k0 + 1) * step, w = hi - lo;
      if (h < minH) continue;
      const score = touchBottom ? w * h + w * 0.001 : w * h + h * 0.001;
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
  /** v28: core road face (neeche) ko chhoona chahiye (L-shape) */
  roadBottom?: boolean;
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
  const core = (args.roadBottom ? maxInscribedRect(inner, 8, 12, true) : null) || maxInscribedRect(inner);
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
const isServiceRoom = (r: any) => /TOILET|BATH|WC|DUCT|SHAFT|STAIR|PASSAGE|DRESSING|LOBBY/i.test(String(r?.name || ''));

export function extendRoomsToPolygon(
  rooms: any[], inner: Pt[], core: Rect, opts?: { avoidService?: boolean },
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
      // v28 (L-shape): toilet / duct / passage / stair wedge me extend na hon -> bedroom / living / kitchen extend hon
      const habitable = opts?.avoidService ? cov.filter((r) => !isServiceRoom(r)) : cov;
      const pick = (habitable.length ? habitable : cov)[0];
      const last = segs[segs.length - 1];
      if (last && last.room === pick && Math.abs(last.b - bps[i]) < 1e-6) last.b = bps[i + 1];
      else segs.push({ a: bps[i], b: bps[i + 1], room: pick });
    }
    if (!segs.length) continue;
    if (opts?.avoidService) {
      // service-only segment (common toilet, duct, passage ...) -> pados ke habitable room ko de do
      for (let si = 0; si < segs.length; si++) {
        if (!isServiceRoom(segs[si].room)) continue;
        const nb = [segs[si - 1], segs[si + 1]].find((q) => q && !isServiceRoom(q.room));
        if (nb) segs[si].room = nb.room;
      }
      for (let si = segs.length - 1; si > 0; si--) {
        if (segs[si].room === segs[si - 1].room && Math.abs(segs[si - 1].b - segs[si].a) < 1e-6) { segs[si - 1].b = segs[si].b; segs.splice(si, 1); }
      }
    }
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
