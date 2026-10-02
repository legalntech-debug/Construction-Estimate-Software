/* =========================================================
   CONSTRUCTION PLAN SYSTEM — LABEL PLACER  (v2)
   Room name + size text kisi bhi line se overlap na kare.

   Is file me DO API hain:
   (A) placeRoomLabels(rooms)  -> ft (plan-local) me, rooms par fields set karta hai
   (B) placeRoomLabel(...)     -> px (SVG) me, renderer (CadFloorPlansView) seedha use karta hai

   v2 me naya:
     - naam ke variants: poora naam -> 2 lines -> 3 lines -> chhota naam (M.BED, A.BATH ...)
     - 90deg ROTATE (lambe/patle room me, jaise 3'-6" ka common toilet)
     - font scale 1 -> 0.5; jagah na mile to size line (9'-4" X 12'-1") hata deta hai
     - door swing ko poora (door width x 1.0) obstacle maanta hai

   (A) ke output fields:
     labelX, labelY           -> NAME block ka center (ft)
     labelLines               -> name ki lines
     dimLabelX, dimLabelY     -> size text ka center
     labelScale               -> 1 ya chhota (labelFontSize * labelScale)
     labelRotate              -> 0 ya -90  (NEW; rotate hone par (labelCx, labelCy) ke around)
     labelCx, labelCy         -> poore block ka center (NEW)
     labelShowDim             -> false ho to size text mat dikhao (NEW)
     labelOverlapFree         -> false ho to koi clean jagah nahi mili

   Call order: generateFloorOpenings() ke BAAD  ->  placeRoomLabels(rooms)
========================================================= */

export interface LabelOptions {
  charWidthFt?: number;
  lineHeightFt?: number;
  dimCharWidthFt?: number;
  dimLineHeightFt?: number;
  wallMarginFt?: number;
  obstaclePadFt?: number;
  gridStepFt?: number;
  /** is se chhota scale kabhi nahi (default 0.5) */
  minScale?: number;
}

type Rect = { x: number; y: number; w: number; h: number };

const DEFAULTS: Required<LabelOptions> = {
  charWidthFt: 0.42,
  lineHeightFt: 0.7,
  dimCharWidthFt: 0.27,
  dimLineHeightFt: 0.45,
  wallMarginFt: 0.35,
  obstaclePadFt: 0.2,
  gridStepFt: 0.25,
  minScale: 0.5,
};

const hit = (a: Rect, b: Rect) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01;

const overlapArea = (a: Rect, b: Rect) => {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > 0 && oy > 0 ? ox * oy : 0;
};

const pad = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

export function formatFeetInches(ft: number): string {
  const total = Math.round(ft * 12);
  const f = Math.floor(total / 12);
  const i = total - f * 12;
  return `${f}'-${i}"`;
}

/** Chhota naam (jab poora naam kisi bhi tarah fit na ho) */
export function shortRoomName(name: string): string {
  const n = String(name || "").toUpperCase();
  if (n.includes("MASTER BEDROOM")) return "M.BED";
  if (n.includes("BEDROOM")) return "BED";
  if (n.includes("COMMON BATH") || n.includes("COMMON TOILET")) return "C.BATH";
  if (n.includes("ATTACHED BATH") || n.includes("ATTACHED TOILET")) return "A.BATH";
  if (n.includes("VENTILATION") || n.includes("OTS") || n.includes("DUCT")) return "DUCT";
  if (n.includes("PARKING")) return "PARK";
  if (n.includes("KITCHEN")) return "KIT";
  if (n.includes("DRAWING")) return "HALL";
  if (n.includes("LIVING")) return "LIVING";
  if (n.includes("BALCONY")) return "BALC";
  return n;
}

/** Door ki jagah + poora swing zone (door width x door width, room ke andar) */
function doorRect(room: Rect, d: any): Rect | null {
  const wall = d.wall as "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  const off = Number(d.offsetFeet || 0);
  const wd = Number(d.widthFeet || 0);
  if (!wd || !wall) return null;
  const opening = String(d.doorType || "").toUpperCase() === "OPENING" || d.renderSymbol === false;
  const depth = opening ? 0.4 : wd;
  switch (wall) {
    case "TOP": return { x: room.x + off, y: room.y, w: wd, h: depth };
    case "BOTTOM": return { x: room.x + off, y: room.y + room.h - depth, w: wd, h: depth };
    case "LEFT": return { x: room.x, y: room.y + off, w: depth, h: wd };
    case "RIGHT": return { x: room.x + room.w - depth, y: room.y + off, w: depth, h: wd };
  }
  return null;
}

function windowRect(room: Rect, w: any): Rect | null {
  const wall = w.wall as "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  const off = Number(w.offsetFeet || 0);
  const len = Number(w.lengthFeet || 0);
  if (!len || !wall) return null;
  const t = 0.5;
  switch (wall) {
    case "TOP": return { x: room.x + off, y: room.y, w: len, h: t };
    case "BOTTOM": return { x: room.x + off, y: room.y + room.h - t, w: len, h: t };
    case "LEFT": return { x: room.x, y: room.y + off, w: t, h: len };
    case "RIGHT": return { x: room.x + room.w - t, y: room.y + off, w: t, h: len };
  }
  return null;
}

/** Naam ke variants: [poora], [2 lines], [3 lines], [short] */
function nameVariantsFt(name: string): string[][] {
  const clean = String(name || "").toUpperCase().trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const out: string[][] = [[clean]];
  if (words.length >= 2) {
    let best: string[] = [clean], bestMax = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
      const m = Math.max(a.length, b.length);
      if (m < bestMax) { bestMax = m; best = [a, b]; }
    }
    out.push(best);
  }
  if (words.length >= 3) out.push(words);
  const sh = shortRoomName(clean);
  if (sh && sh !== clean) out.push([sh]);
  return out;
}

export function placeRoomLabels<T extends { name?: string; x: number; y: number; w: number; h: number }>(
  rooms: T[],
  options: LabelOptions = {},
): T[] {
  const o = { ...DEFAULTS, ...options };
  const out = rooms.map((r) => ({ ...(r as any) })) as any[];

  const childrenOf = (parent: any) =>
    out.filter((c) => c !== parent && (c.subZoneOf || c.attachedTo) &&
      (String(c.subZoneOf) === String(parent.id) || String(c.attachedTo) === String(parent.id)));

  const order = [...out].sort((a, b) => (a.subZoneOf ? 1 : 0) - (b.subZoneOf ? 1 : 0));
  const scales: number[] = [];
  for (let s = 1; s >= o.minScale - 0.001; s -= 0.1) scales.push(Number(s.toFixed(2)));

  for (const room of order) {
    const R: Rect = { x: room.x, y: room.y, w: room.w, h: room.h };
    const usable: Rect = {
      x: R.x + o.wallMarginFt, y: R.y + o.wallMarginFt,
      w: Math.max(0.1, R.w - 2 * o.wallMarginFt), h: Math.max(0.1, R.h - 2 * o.wallMarginFt),
    };

    // ---- obstacles
    const obstacles: Rect[] = [];
    for (const d of room.doors || []) { const r = doorRect(R, d); if (r) obstacles.push(pad(r, o.obstaclePadFt)); }
    for (const w of room.windows || []) { const r = windowRect(R, w); if (r) obstacles.push(pad(r, o.obstaclePadFt)); }
    for (const c of childrenOf(room)) obstacles.push(pad({ x: c.x, y: c.y, w: c.w, h: c.h }, o.obstaclePadFt));
    const st = room.embeddedStair;
    if (st) {
      const sx = Number(st.absX ?? (R.x + (st.relX ?? st.x ?? 0)));
      const sy = Number(st.absY ?? (R.y + (st.relY ?? st.y ?? 0)));
      obstacles.push(pad({ x: sx, y: sy, w: Number(st.w || 0), h: Number(st.h || 0) }, o.obstaclePadFt));
    }
    for (const other of out) {
      if (other === room) continue;
      const oR: Rect = { x: other.x, y: other.y, w: other.w, h: other.h };
      for (const d of other.doors || []) {
        if (d.renderSymbol === false) continue;
        const r = doorRect(oR, d);
        if (r && hit(r, R) && !(other.subZoneOf || other.attachedTo)) obstacles.push(pad(r, o.obstaclePadFt));
      }
    }

    const baseName = room.name || room.label || "";
    const dimText = `${formatFeetInches(room.w)} X ${formatFeetInches(room.h)}`;
    const variants = nameVariantsFt(baseName);

    type Placed = { cx: number; cy: number; scale: number; lines: string[]; rotate: 0 | -90; showDim: boolean; free: boolean };
    let placed: Placed | null = null;

    const tryPlace = (showDim: boolean): Placed | null => {
      for (const scale of scales) {
        for (const lines of variants) {
          for (const rotate of [0, -90] as const) {
            const cW = o.charWidthFt * scale, lH = o.lineHeightFt * scale;
            const dW = o.dimCharWidthFt * scale, dH = o.dimLineHeightFt * scale;
            const nameW = Math.max(...lines.map((l) => l.length)) * cW;
            const bw = Math.max(nameW, showDim ? dimText.length * dW : 0);
            const bh = lines.length * lH + (showDim ? 0.12 + dH : 0);
            // rotate hone par plan me block ki width/height swap
            const pw = rotate === 0 ? bw : bh;
            const ph = rotate === 0 ? bh : bw;
            if (pw > usable.w + 0.01 || ph > usable.h + 0.01) continue;

            let bestC: { cx: number; cy: number; d: number } | null = null;
            const cxMid = usable.x + usable.w / 2, cyMid = usable.y + usable.h / 2;
            for (let yy = usable.y; yy + ph <= usable.y + usable.h + 0.001; yy += o.gridStepFt) {
              for (let xx = usable.x; xx + pw <= usable.x + usable.w + 0.001; xx += o.gridStepFt) {
                const box: Rect = { x: xx, y: yy, w: pw, h: ph };
                if (obstacles.some((ob) => hit(box, ob))) continue;
                const d = Math.hypot(xx + pw / 2 - cxMid, yy + ph / 2 - cyMid);
                if (!bestC || d < bestC.d) bestC = { cx: xx + pw / 2, cy: yy + ph / 2, d };
              }
            }
            if (bestC) return { cx: bestC.cx, cy: bestC.cy, scale, lines, rotate, showDim, free: true };
          }
        }
      }
      return null;
    };

    placed = tryPlace(true) ?? tryPlace(false);

    if (!placed) {
      // best effort: sabse kam overlap, short naam, min scale
      const scale = o.minScale;
      const lines = variants[variants.length - 1];
      const bw = Math.min(usable.w, Math.max(...lines.map((l) => l.length)) * o.charWidthFt * scale);
      const bh = Math.min(usable.h, lines.length * o.lineHeightFt * scale);
      let bestC: { cx: number; cy: number; a: number } | null = null;
      for (let yy = usable.y; yy + bh <= usable.y + usable.h + 0.001; yy += o.gridStepFt) {
        for (let xx = usable.x; xx + bw <= usable.x + usable.w + 0.001; xx += o.gridStepFt) {
          const box: Rect = { x: xx, y: yy, w: bw, h: bh };
          const a = obstacles.reduce((s, ob) => s + overlapArea(box, ob), 0);
          if (!bestC || a < bestC.a) bestC = { cx: xx + bw / 2, cy: yy + bh / 2, a };
        }
      }
      placed = { cx: bestC?.cx ?? R.x + R.w / 2, cy: bestC?.cy ?? R.y + R.h / 2, scale, lines, rotate: 0, showDim: false, free: false };
    }

    const lH = o.lineHeightFt * placed.scale;
    const dH = o.dimLineHeightFt * placed.scale;
    const dimBlock = placed.showDim ? 0.12 + dH : 0;
    const blockH = placed.lines.length * lH + dimBlock;
    const top = placed.cy - blockH / 2;
    room.labelLines = placed.lines;
    room.labelX = Number(placed.cx.toFixed(3));
    room.labelY = Number((top + (placed.lines.length * lH) / 2).toFixed(3));
    room.dimLabelX = Number(placed.cx.toFixed(3));
    room.dimLabelY = Number((top + placed.lines.length * lH + 0.12 + dH / 2).toFixed(3));
    room.labelCx = Number(placed.cx.toFixed(3));
    room.labelCy = Number(placed.cy.toFixed(3));
    room.labelRotate = placed.rotate;
    room.labelShowDim = placed.showDim;
    room.labelScale = placed.scale;
    room.labelOverlapFree = placed.free;
  }

  return out as T[];
}

/* =========================================================
   (B) PIXEL-BASED PLACER — CadFloorPlansView (SVG) seedha use karta hai
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

  const pick = (best as Cand | null) ?? (bestAny as Cand | null);
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