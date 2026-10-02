/* =========================================================
   LABEL PLACEMENT ENGINE
   Room ka naam + size text kisi bhi line / door-swing / stair / sub-room se
   overlap na kare. Sab kuch SVG px coordinates me.

   Flow:
     1) Room ke andar se saare obstacles (stair, attached toilet, door swing, ...) kaat do
     2) Bachi hui khali rectangles me se har ek me text fit karne ki koshish:
          - normal  -> wrap (1/2/3 lines) -> rotate -90deg -> chhota naam (M.BED, A.BATH)
          - font size automatically chhota/bada
     3) Sabse bada font dene wali (aur room ke center ke paas) rectangle jeet-ti hai
========================================================= */

export interface Box { x: number; y: number; w: number; h: number }

export interface LabelLine { text: string; x: number; y: number; fontSize: number; kind: "name" | "dim" }

export interface LabelPlacement {
  lines: LabelLine[];
  /** 0 ya -90. -90 hone par poora block (cx, cy) ke around rotate karo */
  rotate: 0 | -90;
  cx: number;
  cy: number;
  /** Jis free rectangle me label rakha gaya */
  area: Box;
  /** true => koi bhi free jagah me min font par bhi fit nahi hua (label clip hoga) */
  overflow: boolean;
}

export interface PlaceLabelInput {
  room: Box;
  obstacles: Box[];
  /** Naam ke variants: pehle sabse poora, baad me chhote. Har variant = lines ka array */
  nameVariants: string[][];
  dimText?: string;
  pad?: number;
  maxFont?: number;
  minFont?: number;
  minDimFont?: number;
}

const CHAR_W = 0.64;   // bold uppercase ka avg width / fontSize
const LINE_H = 1.22;

const inter = (a: Box, b: Box) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01;

/** Obstacles hata kar bachi hui khali (maximal-ish) rectangles, bade area pehle */
export function freeRects(room: Box, obstacles: Box[], pad = 0, limit = 14): Box[] {
  const inner: Box = { x: room.x + pad, y: room.y + pad, w: room.w - 2 * pad, h: room.h - 2 * pad };
  if (inner.w <= 0 || inner.h <= 0) return [];
  const obs = obstacles.filter(o => inter(o, inner));

  const xs = new Set<number>([inner.x, inner.x + inner.w]);
  const ys = new Set<number>([inner.y, inner.y + inner.h]);
  for (const o of obs) {
    xs.add(Math.min(inner.x + inner.w, Math.max(inner.x, o.x)));
    xs.add(Math.min(inner.x + inner.w, Math.max(inner.x, o.x + o.w)));
    ys.add(Math.min(inner.y + inner.h, Math.max(inner.y, o.y)));
    ys.add(Math.min(inner.y + inner.h, Math.max(inner.y, o.y + o.h)));
  }
  const X = [...xs].sort((a, b) => a - b);
  const Y = [...ys].sort((a, b) => a - b);

  const cellFree = (i: number, j: number) => {
    const c: Box = { x: X[i], y: Y[j], w: X[i + 1] - X[i], h: Y[j + 1] - Y[j] };
    if (c.w < 0.01 || c.h < 0.01) return true;
    return !obs.some(o => inter(o, c));
  };

  const nx = X.length - 1, ny = Y.length - 1;
  const free: boolean[][] = Array.from({ length: nx }, (_, i) => Array.from({ length: ny }, (_, j) => cellFree(i, j)));

  const out: Box[] = [];
  for (let i0 = 0; i0 < nx; i0++) for (let j0 = 0; j0 < ny; j0++) {
    if (!free[i0][j0]) continue;
    let jMax = ny;
    for (let i1 = i0; i1 < nx; i1++) {
      let j1 = j0;
      while (j1 < jMax && free[i1][j1]) j1++;
      jMax = j1;
      if (jMax <= j0) break;
      out.push({ x: X[i0], y: Y[j0], w: X[i1 + 1] - X[i0], h: Y[jMax] - Y[j0] });
    }
  }
  out.sort((a, b) => b.w * b.h - a.w * a.h);
  return out.slice(0, limit);
}

interface Fit { fs: number; dimFs: number; withDim: boolean; rotate: 0 | -90; lines: string[]; score: number; ok: boolean }

function fitText(
  box: Box, lines: string[], dimText: string | undefined,
  maxFont: number, minFont: number, minDimFont: number,
): Fit | null {
  let best: Fit | null = null;
  for (const rotate of [0, -90] as const) {
    const W = rotate === 0 ? box.w : box.h;
    const H = rotate === 0 ? box.h : box.w;
    for (const withDim of dimText ? [true, false] : [false]) {
      const nameChars = Math.max(...lines.map(l => l.length));
      const dimChars = withDim ? dimText!.length * 0.85 : 0; // dim text 0.85x font
      const widest = Math.max(nameChars, dimChars);
      const rows = lines.length + (withDim ? 0.85 : 0);
      const fs = Math.min(maxFont, W / (widest * CHAR_W), H / (rows * LINE_H));
      if (!(fs > 0)) continue;
      const dimFs = fs * 0.85;
      if (withDim && dimFs < minDimFont) continue;
      const ok = fs >= minFont;
      // Score: bada font, dim included, rotate nahi, kam lines
      const score = fs * (rotate === 0 ? 1 : 0.8) * (withDim ? 1.12 : 1) * (lines.length === 1 ? 1.05 : 1);
      if (!best || score > best.score) best = { fs, dimFs, withDim, rotate, lines, score, ok };
    }
  }
  return best;
}

export function placeRoomLabel(inp: PlaceLabelInput): LabelPlacement {
  const pad = inp.pad ?? 1.5;
  const maxFont = inp.maxFont ?? 3.8;
  const minFont = inp.minFont ?? 1.8;
  const minDimFont = inp.minDimFont ?? 1.4;
  const rects = freeRects(inp.room, inp.obstacles, pad);
  const rcx = inp.room.x + inp.room.w / 2;
  const rcy = inp.room.y + inp.room.h / 2;

  type Cand = { fit: Fit; box: Box; rank: number };
  let best: Cand | null = null;
  let bestAny: Cand | null = null;

  // Variants order = preference (poora naam pehle). Pehla variant jo ok fit ho, use priority milti hai.
  inp.nameVariants.forEach((lines, vIdx) => {
    for (const box of rects) {
      const fit = fitText(box, lines, inp.dimText, maxFont, minFont, minDimFont);
      if (!fit) continue;
      const bcx = box.x + box.w / 2, bcy = box.y + box.h / 2;
      const dist = Math.hypot(bcx - rcx, bcy - rcy) / Math.max(1, Math.hypot(inp.room.w, inp.room.h));
      // variant penalty: chhota naam tabhi jab poora naam bahut chhota font de
      const rank = fit.score * (1 - vIdx * 0.18) - dist * 0.6;
      const cand = { fit, box, rank };
      if (!bestAny || rank > bestAny.rank) bestAny = cand;
      if (fit.ok && (!best || rank > best.rank)) best = cand;
    }
  });

  const pick = best ?? bestAny;
  if (!pick) {
    // koi free rect hi nahi -> room center, min font, overflow flag
    const lines = inp.nameVariants[inp.nameVariants.length - 1] || [""];
    return {
      lines: lines.map((t, i) => ({ text: t, x: rcx, y: rcy + (i - (lines.length - 1) / 2) * minFont * LINE_H, fontSize: minFont, kind: "name" as const })),
      rotate: 0, cx: rcx, cy: rcy, area: inp.room, overflow: true,
    };
  }

  const { fit, box } = pick;
  const fs = Math.max(fit.ok ? fit.fs : minFont, 0.1);
  const dimFs = fit.withDim ? fs * 0.85 : 0;
  const rows = fit.lines.length + (fit.withDim ? 0.85 : 0);
  const blockH = rows * fs * LINE_H;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  // Block (rotate se pehle) apne (cx, cy) ke around vertically centered
  const lines: LabelLine[] = [];
  let y = cy - blockH / 2 + (fs * LINE_H) / 2;
  fit.lines.forEach(t => { lines.push({ text: t, x: cx, y, fontSize: fs, kind: "name" }); y += fs * LINE_H; });
  if (fit.withDim && inp.dimText) lines.push({ text: inp.dimText, x: cx, y: y - (fs * LINE_H) / 2 + (dimFs * LINE_H) / 2, fontSize: dimFs, kind: "dim" });

  return { lines, rotate: fit.rotate, cx, cy, area: box, overflow: !fit.ok };
}

/** Naam ke variants: [1 line], [2 lines], [3 lines], phir short label */
export function buildNameVariants(full: string, short: string): string[][] {
  const words = full.trim().split(/\s+/).filter(Boolean);
  const variants: string[][] = [[full]];
  if (words.length >= 2) {
    // 2 lines: best split jo lines ko balanced rakhe
    let bestSplit = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ").length, b = words.slice(i).join(" ").length;
      if (Math.abs(a - b) < bestDiff) { bestDiff = Math.abs(a - b); bestSplit = i; }
    }
    variants.push([words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")]);
  }
  if (words.length >= 3) variants.push(words);
  if (short && short !== full) variants.push([short]);
  return variants;
}

/** Door ka swing area (SVG px), existing renderer ke doorSwingDepth jaisa, thoda margin ke saath */
export function doorSwingBox(
  door: { wall?: string; offsetFeet?: number; widthFeet?: number; swingInside?: boolean },
  room: Box, scale: number, margin = 0.15,
): Box {
  const off = (door.offsetFeet || 0) * scale;
  const span = (door.widthFeet || 3) * scale;
  const depth = span * (1 + margin);          // pura leaf radius + margin
  const inside = Boolean(door.swingInside);
  const m = span * margin / 2;
  switch (door.wall) {
    case "TOP":    return { x: room.x + off - m, y: inside ? room.y : room.y - depth, w: span + 2 * m, h: depth };
    case "BOTTOM": return { x: room.x + off - m, y: inside ? room.y + room.h - depth : room.y + room.h, w: span + 2 * m, h: depth };
    case "LEFT":   return { x: inside ? room.x : room.x - depth, y: room.y + off - m, w: depth, h: span + 2 * m };
    default:       return { x: inside ? room.x + room.w - depth : room.x + room.w, y: room.y + off - m, w: depth, h: span + 2 * m };
  }
}