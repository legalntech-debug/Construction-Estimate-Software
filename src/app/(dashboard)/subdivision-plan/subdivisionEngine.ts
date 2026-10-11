/* =========================================================
SUB DIVISION LAYOUT — GEOMETRY ENGINE (pure functions)
---------------------------------------------------------
- Kisi bhi (convex ya L/concave) polygon plot ko line se todta hai
- Equal split, "distance se cut", "size se carve (W x D x N)"
- Har piece ke liye area / bbox / rectangle-check / PlotDimensions
Koi React / DOM dependency nahi — isliye test karna easy hai.
========================================================= */

import type { Corner, CutLine, EdgeFrom, PieceInfo, PlotDimensions, Pt, SubPiece } from "./subdivisionTypes";

export const EPS = 1e-6;
const round = (n: number, d = 4) => Number(n.toFixed(d));

/* ---------------- basic geometry ---------------- */

export function polygonArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

export function polygonBBox(poly: Pt[]) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function polygonCentroid(poly: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < EPS) {
    const b = polygonBBox(poly);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

function distPointSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Point polygon ke ANDAR hai (boundary par nahi). */
export function pointStrictlyInside(p: Pt, poly: Pt[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (distPointSegment(p, poly[i], poly[(i + 1) % poly.length]) < 1e-5) return false;
  }
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Collinear / duplicate vertices hata deta hai. */
export function simplifyPolygon(poly: Pt[]): Pt[] {
  let pts = poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.hypot(p.x - q.x, p.y - q.y) > 1e-6;
  });
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1e-6) {
        pts = pts.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

export function isAxisRect(poly: Pt[]): boolean {
  if (poly.length !== 4) return false;
  const b = polygonBBox(poly);
  return Math.abs(polygonArea(poly) - b.w * b.h) < 1e-3;
}

/* ---------------- polygon split by an (infinite) line ---------------- */

type Hit = { ring: number; t: number };

/**
 * Polygon ko line (a->b) se todta hai. Concave (L-shape) polygon me line
 * kai jagah kaat sakti hai — to 2 se zyada pieces bhi aa sakte hain.
 */
export function splitPolygonByLine(poly: Pt[], a: Pt, b: Pt): Pt[][] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return [poly];
  const nx = -dy / len, ny = dx / len; // normal
  const side = (p: Pt) => (p.x - a.x) * nx + (p.y - a.y) * ny;
  const along = (p: Pt) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / len;

  // 1) ring banao: vertices + edge-crossing points
  const ring: Pt[] = [];
  const hits: Hit[] = [];
  const d = poly.map(side);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    ring.push(p);
    if (Math.abs(d[i]) < 1e-7) {
      hits.push({ ring: ring.length - 1, t: along(p) });
    }
    const dn = d[(i + 1) % poly.length];
    if (Math.abs(d[i]) >= 1e-7 && Math.abs(dn) >= 1e-7 && d[i] * dn < 0) {
      const k = d[i] / (d[i] - dn);
      const ip = { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
      ring.push(ip);
      hits.push({ ring: ring.length - 1, t: along(ip) });
    }
  }
  if (hits.length < 2) return [poly];
  hits.sort((m, n) => m.t - n.t);

  // 2) pehla chord jo polygon ke andar ho
  for (let i = 0; i + 1 < hits.length; i++) {
    const h0 = hits[i], h1 = hits[i + 1];
    if (Math.abs(h1.t - h0.t) < 1e-6) continue;
    const p0 = ring[h0.ring], p1 = ring[h1.ring];
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    if (!pointStrictlyInside(mid, poly)) continue;

    const i0 = Math.min(h0.ring, h1.ring);
    const i1 = Math.max(h0.ring, h1.ring);
    const A = ring.slice(i0, i1 + 1);
    const B = [...ring.slice(i1), ...ring.slice(0, i0 + 1)];
    const out: Pt[][] = [];
    for (const piece of [A, B]) {
      const s = simplifyPolygon(piece);
      if (s.length >= 3 && polygonArea(s) > 1e-4) {
        out.push(...splitPolygonByLine(s, a, b)); // aur chords ho sakte hain
      }
    }
    return out.length ? out : [poly];
  }
  return [poly];
}

/* ---------------- piece operations ---------------- */

let uid = 0;
const nid = () => `p${++uid}`;

/** id `p1` ke descendants: p1, p1a, p1ab ... (p10 NAHI). */
export const isDescendant = (id: string, root: string) => id.startsWith(root) && /^[a-z]*$/.test(id.slice(root.length));

export function createRoot(polygon: Pt[]): SubPiece[] {
  return [{ id: nid(), polygon: simplifyPolygon(polygon), kind: "PLOT" }];
}

/** Cut apply karo. scope ALL = har piece jo line se katta ho; PIECE = sirf ek piece. */
export function applyCut(pieces: SubPiece[], cut: CutLine): SubPiece[] {
  const out: SubPiece[] = [];
  for (const pc of pieces) {
    if (cut.scope === "PIECE" && pc.id !== cut.pieceId) {
      out.push(pc);
      continue;
    }
    const parts = splitPolygonByLine(pc.polygon, cut.a, cut.b);
    if (parts.length <= 1) {
      out.push(pc);
    } else {
      parts.forEach((poly, i) => out.push({ id: `${pc.id}${String.fromCharCode(97 + (i % 26))}`, polygon: poly, kind: pc.kind }));
    }
  }
  return out;
}

/** Vertical cut x = value (feet). */
export const verticalCut = (x: number, y0 = -1e4, y1 = 1e4): Pick<CutLine, "a" | "b"> => ({ a: { x, y: y0 }, b: { x, y: y1 } });
/** Horizontal cut y = value (feet). */
export const horizontalCut = (y: number, x0 = -1e4, x1 = 1e4): Pick<CutLine, "a" | "b"> => ({ a: { x: x0, y }, b: { x: x1, y } });

/** Piece ko `n` barabar hisson me (vertical = left->right strips). */
export function equalSplit(pieces: SubPiece[], pieceId: string, n: number, direction: "VERTICAL" | "HORIZONTAL"): SubPiece[] {
  const pc = pieces.find((p) => p.id === pieceId);
  if (!pc || n < 2) return pieces;
  const bb = polygonBBox(pc.polygon);
  let cur = pieces;
  // sirf usi piece ke strips — scope PIECE, lekin id split ke baad badal jaati hai,
  // isliye bbox-band ke andar wale sab descendants par apply karte hain
  const ids = () => cur.filter((p) => isDescendant(p.id, pieceId));
  for (let i = 1; i < n; i++) {
    const pos = direction === "VERTICAL" ? bb.minX + (bb.w * i) / n : bb.minY + (bb.h * i) / n;
    const line = direction === "VERTICAL" ? verticalCut(pos) : horizontalCut(pos);
    const targets = new Set(ids().map((p) => p.id));
    cur = cur.flatMap((p) => (targets.has(p.id) ? applyCut([p], { ...line, scope: "ALL" }) : [p]));
  }
  return cur;
}

/** Piece ke ek edge se `distance` ft par cut (e.g. LEFT se 10 ft = 10 ft ka strip). */
export function cutAtDistance(pieces: SubPiece[], pieceId: string, from: EdgeFrom, distance: number): SubPiece[] {
  const pc = pieces.find((p) => p.id === pieceId);
  if (!pc || distance <= 0) return pieces;
  const bb = polygonBBox(pc.polygon);
  let line: Pick<CutLine, "a" | "b">;
  if (from === "LEFT") line = verticalCut(bb.minX + distance);
  else if (from === "RIGHT") line = verticalCut(bb.maxX - distance);
  else if (from === "TOP") line = horizontalCut(bb.minY + distance);
  else line = horizontalCut(bb.maxY - distance);
  return applyCut(pieces, { ...line, scope: "PIECE", pieceId });
}

/**
 * Size se carve: piece ke corner se W x D ke `count` plots nikalo.
 * Direction = row (side-by-side). Jo bacha wo REMAINDER mark hota hai.
 * Example: 30x50 me W=10, D=30, count=3  ->  teen 10x30 + bacha hua hissa.
 */
export function carvePlots(
  pieces: SubPiece[],
  pieceId: string,
  opts: { w: number; d: number; count: number; corner: Corner }
): SubPiece[] {
  const pc = pieces.find((p) => p.id === pieceId);
  if (!pc) return pieces;
  const { w, d, count, corner } = opts;
  const bb = polygonBBox(pc.polygon);
  const fromLeft = corner === "TL" || corner === "BL";
  const fromTop = corner === "TL" || corner === "TR";
  const xAt = (i: number) => (fromLeft ? bb.minX + w * i : bb.maxX - w * i);
  const yAt = fromTop ? bb.minY + d : bb.maxY - d;

  let cur = pieces;
  const root = pieceId;
  const inRoot = (p: SubPiece) => isDescendant(p.id, root);
  for (let i = 1; i <= count; i++) {
    if (i === count && Math.abs((fromLeft ? xAt(i) - bb.maxX : xAt(i) - bb.minX)) < 1e-6) continue;
    const t = new Set(cur.filter(inRoot).map((p) => p.id));
    const line = verticalCut(xAt(i));
    cur = cur.flatMap((p) => (t.has(p.id) ? applyCut([p], { ...line, scope: "ALL" }) : [p]));
  }
  const t2 = new Set(cur.filter(inRoot).map((p) => p.id));
  const hLine = horizontalCut(yAt);
  cur = cur.flatMap((p) => (t2.has(p.id) ? applyCut([p], { ...hLine, scope: "ALL" }) : [p]));

  // kaun se pieces carve kiye hue plots hain?
  const xMin = fromLeft ? bb.minX : bb.maxX - w * count;
  const xMax = fromLeft ? bb.minX + w * count : bb.maxX;
  const yMin = fromTop ? bb.minY : bb.maxY - d;
  const yMax = fromTop ? bb.minY + d : bb.maxY;
  return cur.map((p) => {
    if (!inRoot(p)) return p;
    const b = polygonBBox(p.polygon);
    const inside = b.minX >= xMin - 1e-4 && b.maxX <= xMax + 1e-4 && b.minY >= yMin - 1e-4 && b.maxY <= yMax + 1e-4;
    return { ...p, kind: inside ? "PLOT" : "REMAINDER" };
  });
}

/** Do adjacent pieces ko merge (agar union simple polygon ho). Shared edge dhoondta hai. */
export function mergePieces(pieces: SubPiece[], idA: string, idB: string): SubPiece[] | null {
  const A = pieces.find((p) => p.id === idA);
  const B = pieces.find((p) => p.id === idB);
  if (!A || !B) return null;
  const key = (p: Pt) => `${round(p.x, 3)},${round(p.y, 3)}`;
  const edges = new Map<string, { a: Pt; b: Pt }>();
  const add = (poly: Pt[]) => {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      edges.set(`${key(p)}>${key(q)}`, { a: p, b: q });
    }
  };
  // orientation same karo
  const ccw = (poly: Pt[]) => poly.reduce((s, p, i) => s + (poly[(i + 1) % poly.length].x - p.x) * (poly[(i + 1) % poly.length].y + p.y), 0) < 0;
  const orient = (poly: Pt[]) => (ccw(poly) ? poly : [...poly].reverse());
  add(orient(A.polygon));
  add(orient(B.polygon));
  // opposite edges cancel
  let shared = 0;
  for (const [k, e] of Array.from(edges.entries())) {
    const rk = `${key(e.b)}>${key(e.a)}`;
    if (edges.has(rk) && edges.has(k)) {
      edges.delete(k);
      edges.delete(rk);
      shared++;
    }
  }
  if (!shared) return null;
  const rest = Array.from(edges.values());
  if (!rest.length) return null;
  const next = new Map(rest.map((e) => [key(e.a), e]));
  const ring: Pt[] = [];
  let cur = rest[0];
  const startKey = key(cur.a);
  for (let i = 0; i <= rest.length; i++) {
    ring.push(cur.a);
    const n = next.get(key(cur.b));
    if (!n) return null;
    if (key(n.a) === startKey) break;
    cur = n;
  }
  if (ring.length !== rest.length) return null; // simple polygon nahi bana
  const merged: SubPiece = { id: idA, polygon: simplifyPolygon(ring), kind: A.kind };
  return pieces.filter((p) => p.id !== idB).map((p) => (p.id === idA ? merged : p));
}

/* ---------------- display info ---------------- */

export function describePieces(pieces: SubPiece[]): PieceInfo[] {
  const rows = pieces.map((p) => {
    const bbox = polygonBBox(p.polygon);
    return { p, bbox, centroid: polygonCentroid(p.polygon) };
  });
  // top-left se bottom-right: pehle y-band, phir x
  const sorted = [...rows].sort((m, n) => (Math.abs(m.bbox.minY - n.bbox.minY) > 0.5 ? m.bbox.minY - n.bbox.minY : m.bbox.minX - n.bbox.minX));
  let plotNo = 0, openNo = 0;
  return sorted.map((r) => {
    const num = r.p.kind === "PLOT" ? ++plotNo : ++openNo;
    return {
      ...r.p,
      number: num,
      label: r.p.kind === "PLOT" ? `PLOT ${num}` : `OPEN ${num}`,
      area: round(polygonArea(r.p.polygon), 2),
      bbox: r.bbox,
      isRect: isAxisRect(r.p.polygon),
      centroid: r.centroid,
    };
  });
}

/**
 * Piece ko existing construction-plan engine ke PlotDimensions me badlo.
 * Rectangle: A=B=width, C=D=depth. Non-rect: bbox + polygon (vertices alag se pass karo).
 */
export function pieceToPlotDimensions(piece: PieceInfo): PlotDimensions {
  const w = round(piece.bbox.w, 2);
  const h = round(piece.bbox.h, 2);
  return {
    length: h,
    width: w,
    area: piece.area,
    A: w,
    B: w,
    C: h,
    D: h,
    E: 0,
    F: 0,
  };
}

/** Piece ko (0,0) se shuru hone wale polygon me shift karo (planner ke liye). */
export function normalizedPolygon(piece: PieceInfo): Pt[] {
  return piece.polygon.map((p) => ({ x: round(p.x - piece.bbox.minX, 3), y: round(p.y - piece.bbox.minY, 3) }));
}

/* ---------------- plot presets ---------------- */

export function rectPlot(w: number, d: number): Pt[] {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];
}

/** L-shape: corner cut (cw x ch) kisi ek corner se hata do. */
export function lShapePlot(w: number, d: number, cw: number, ch: number, cutCorner: Corner): Pt[] {
  switch (cutCorner) {
    case "TL": return [{ x: cw, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }, { x: 0, y: ch }, { x: cw, y: ch }];
    case "TR": return [{ x: 0, y: 0 }, { x: w - cw, y: 0 }, { x: w - cw, y: ch }, { x: w, y: ch }, { x: w, y: d }, { x: 0, y: d }];
    case "BL": return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: cw, y: d }, { x: cw, y: d - ch }, { x: 0, y: d - ch }];
    default:   return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d - ch }, { x: w - cw, y: d - ch }, { x: w - cw, y: d }, { x: 0, y: d }];
  }
}

/** Trapezoid: top width, bottom width, left height, right height. */
export function trapezoidPlot(top: number, bottom: number, left: number, right: number): Pt[] {
  const maxW = Math.max(top, bottom);
  const tx = (maxW - top) / 2, bx = (maxW - bottom) / 2;
  const maxH = Math.max(left, right);
  return [
    { x: tx, y: maxH - left },
    { x: tx + top, y: maxH - right },
    { x: bx + bottom, y: maxH },
    { x: bx, y: maxH },
  ];
}
