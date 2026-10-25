/* =========================================================
SUBDIVISION LAYOUTS — TEMPLATE + MANUAL MODES (pure functions)
---------------------------------------------------------
Coordinates: origin = top-left corner of the plot, x to the right,
y downwards, expressed in the plot's measurement unit (feet or metres).

TEMPLATE mode : the user picks a layout pattern (side by side, front + back
                row, corner L-layout, internal road, ...) and enters the
                width / depth of every piece. The pattern decides where each
                piece is placed.
MANUAL mode   : the user places every piece by hand (rectangle, L-shape,
                trapezoid or free polygon).
No React / DOM dependency, so every function can be unit tested.
========================================================= */

import type { PieceInfo, Pt } from "./subdivisionTypes";
import { isAxisRect, lShapePlot, polygonArea, polygonBBox, polygonCentroid, trapezoidPlot } from "./subdivisionEngine";

export type MeasurementUnit = "FEET" | "METERS";

const r2 = (n: number) => Number(n.toFixed(2));
const r4 = (n: number) => Number(n.toFixed(4));
const num = (v: unknown) => Math.max(0, Number(v) || 0);
const unitShort = (u: MeasurementUnit) => (u === "METERS" ? "m" : "ft");

/* ---------------------------------------------------------
   Shared output helper: polygons -> PieceInfo[]
--------------------------------------------------------- */

export interface PolySpec {
  id?: string;
  label: string;
  kind: "PLOT" | "REMAINDER";
  polygon: Pt[];
}

export function polysToPieceInfos(specs: PolySpec[]): PieceInfo[] {
  let plotNo = 0;
  return specs.map((s, idx) => {
    const polygon = s.polygon.map((p) => ({ x: r4(p.x), y: r4(p.y) }));
    const isPlot = s.kind === "PLOT";
    const number = isPlot ? ++plotNo : 0;
    return {
      id: s.id || (isPlot ? `p${number}` : `o${idx + 1}`),
      polygon,
      kind: s.kind,
      number,
      label: s.label,
      area: r2(polygonArea(polygon)),
      bbox: polygonBBox(polygon),
      isRect: isAxisRect(polygon),
      centroid: polygonCentroid(polygon),
    };
  });
}

const rectPoly = (x: number, y: number, w: number, d: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + d },
  { x, y: y + d },
];

/* ---------------------------------------------------------
   Layout check (inside plot / overlap / balance area)
--------------------------------------------------------- */

export interface LayoutCheck {
  issues: string[];
  plotArea: number;
  allocatedArea: number;
  balanceArea: number;
  ok: boolean;
}

export function checkLayout(plotW: number, plotD: number, pieces: PieceInfo[], unit: MeasurementUnit): LayoutCheck {
  const issues: string[] = [];
  const tol = 0.01;
  const u = unit === "METERS" ? "SQ.M" : "SQ.FT";

  for (const p of pieces) {
    const b = p.bbox;
    if (b.minX < -tol || b.minY < -tol || b.maxX > plotW + tol || b.maxY > plotD + tol) {
      issues.push(`"${p.label}" extends outside the plot boundary.`);
    }
  }

  const rects = pieces.filter((p) => p.isRect);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].bbox;
      const b = rects[j].bbox;
      const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const oy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
      if (ox > tol && oy > tol) issues.push(`"${rects[i].label}" overlaps "${rects[j].label}".`);
    }
  }

  const plotArea = r2(plotW * plotD);
  const allocatedArea = r2(pieces.reduce((s, p) => s + p.area, 0));
  const balanceArea = r2(plotArea - allocatedArea);
  if (balanceArea < -0.5) issues.push(`Pieces total ${allocatedArea} ${u}, which is more than the plot area (${plotArea} ${u}).`);

  return { issues, plotArea, allocatedArea, balanceArea, ok: issues.length === 0 };
}

/* =========================================================
   TEMPLATE MODE
========================================================= */

export type TemplateId = "ROW" | "STACK" | "TWO_ROWS" | "CORNER_L" | "CENTRE_ROAD" | "REAR_PASSAGE" | "GRID";

export interface TemplatePieceInput {
  label: string;
  widthFt: number;
  depthFt: number;
}

export interface TemplateConfig {
  id: TemplateId;
  count1: number;
  count2: number;
  gapFt: number; // road / passage width
  side: "LEFT" | "RIGHT"; // passage side (REAR_PASSAGE) / side column side (CORNER_L)
  pieces: TemplatePieceInput[];
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  hint: string;
  count1Label: string;
  count2Label?: string;
  gapLabel?: string;
  sideLabel?: string;
  count1: number;
  count2: number;
  min1: number;
  max1: number;
  min2: number;
  max2: number;
}

export const TEMPLATE_META: TemplateMeta[] = [
  { id: "ROW", name: "SIDE BY SIDE", hint: "One row, left to right", count1Label: "NUMBER OF PLOTS", count1: 3, count2: 0, min1: 2, max1: 12, min2: 0, max2: 0 },
  { id: "STACK", name: "ONE BELOW ANOTHER", hint: "One column, top to bottom", count1Label: "NUMBER OF PLOTS", count1: 3, count2: 0, min1: 2, max1: 12, min2: 0, max2: 0 },
  { id: "TWO_ROWS", name: "FRONT + BACK ROW", hint: "Two rows, back to back", count1Label: "FRONT ROW PLOTS", count2Label: "BACK ROW PLOTS", count1: 2, count2: 2, min1: 1, max1: 8, min2: 1, max2: 8 },
  { id: "CORNER_L", name: "CORNER (L-LAYOUT)", hint: "Top row + side column + inner plot", count1Label: "TOP ROW PLOTS", count2Label: "SIDE COLUMN PLOTS", sideLabel: "SIDE COLUMN ON", count1: 3, count2: 2, min1: 1, max1: 8, min2: 1, max2: 8 },
  { id: "CENTRE_ROAD", name: "ROAD IN THE MIDDLE", hint: "Plots on both sides of an internal road", count1Label: "LEFT SIDE PLOTS", count2Label: "RIGHT SIDE PLOTS", gapLabel: "ROAD WIDTH", count1: 2, count2: 2, min1: 1, max1: 8, min2: 1, max2: 8 },
  { id: "REAR_PASSAGE", name: "FRONT + REAR WITH PASSAGE", hint: "Back plot reached through a passage", count1Label: "FRONT PLOTS", gapLabel: "PASSAGE WIDTH", sideLabel: "PASSAGE ON", count1: 2, count2: 0, min1: 1, max1: 8, min2: 0, max2: 0 },
  { id: "GRID", name: "GRID (ROWS × COLUMNS)", hint: "Each plot sized separately", count1Label: "COLUMNS", count2Label: "ROWS", count1: 3, count2: 2, min1: 1, max1: 8, min2: 1, max2: 8 },
];

export const getTemplateMeta = (id: TemplateId) => TEMPLATE_META.find((t) => t.id === id) || TEMPLATE_META[0];

export function templateSlotCount(cfg: TemplateConfig): number {
  switch (cfg.id) {
    case "ROW":
    case "STACK":
      return cfg.count1;
    case "TWO_ROWS":
    case "CENTRE_ROAD":
      return cfg.count1 + cfg.count2;
    case "CORNER_L":
      return cfg.count1 + cfg.count2 + 1; // top row + side column + inner plot
    case "REAR_PASSAGE":
      return cfg.count1 + 1;
    case "GRID":
      return cfg.count1 * cfg.count2;
    default:
      return cfg.count1;
  }
}

/** Heading shown above a group of rows in the size table ("" = no heading). */
export function slotGroupLabel(cfg: TemplateConfig, i: number): string {
  switch (cfg.id) {
    case "TWO_ROWS":
      return i < cfg.count1 ? "FRONT ROW" : "BACK ROW";
    case "CORNER_L":
      return i < cfg.count1 ? "TOP ROW" : i < cfg.count1 + cfg.count2 ? "SIDE COLUMN" : "INNER PLOT";
    case "CENTRE_ROAD":
      return i < cfg.count1 ? "LEFT SIDE" : "RIGHT SIDE";
    case "REAR_PASSAGE":
      return i < cfg.count1 ? "FRONT ROW" : "REAR PLOT";
    case "GRID":
      return `ROW ${Math.floor(i / Math.max(1, cfg.count1)) + 1}`;
    default:
      return "";
  }
}

/** Default piece sizes that fill the plot for the chosen template. Existing labels are kept. */
export function autoFillTemplatePieces(plotW: number, plotD: number, cfg: TemplateConfig): TemplatePieceInput[] {
  const W = Math.max(0, plotW);
  const D = Math.max(0, plotD);
  const slots = templateSlotCount(cfg);
  const gap = num(cfg.gapFt);
  const out: TemplatePieceInput[] = [];
  const size = (i: number): { w: number; d: number } => {
    switch (cfg.id) {
      case "ROW":
        return { w: W / cfg.count1, d: D };
      case "STACK":
        return { w: W, d: D / cfg.count1 };
      case "TWO_ROWS":
        return i < cfg.count1 ? { w: W / cfg.count1, d: D / 2 } : { w: W / Math.max(1, cfg.count2), d: D / 2 };
      case "CORNER_L": {
        const topD = D / (cfg.count2 + 1);
        const colW = W / cfg.count1;
        if (i < cfg.count1) return { w: colW, d: topD };
        if (i < cfg.count1 + cfg.count2) return { w: colW, d: (D - topD) / Math.max(1, cfg.count2) };
        return { w: W - colW, d: D - topD }; // inner plot
      }
      case "CENTRE_ROAD": {
        const colW = Math.max(0, (W - gap) / 2);
        return i < cfg.count1 ? { w: colW, d: D / cfg.count1 } : { w: colW, d: D / Math.max(1, cfg.count2) };
      }
      case "REAR_PASSAGE":
        return i < cfg.count1 ? { w: Math.max(0, (W - gap) / cfg.count1), d: D / 2 } : { w: W, d: D / 2 };
      case "GRID":
        return { w: W / cfg.count1, d: D / Math.max(1, cfg.count2) };
      default:
        return { w: W, d: D };
    }
  };
  for (let i = 0; i < slots; i++) {
    const s = size(i);
    out.push({ label: cfg.pieces[i]?.label || "", widthFt: r2(s.w), depthFt: r2(s.d) });
  }
  return out;
}

export function defaultTemplateConfig(
  plotW: number,
  plotD: number,
  id: TemplateId = "ROW",
  unit: MeasurementUnit = "FEET",
  keep?: Pick<TemplateConfig, "gapFt" | "side">
): TemplateConfig {
  const meta = getTemplateMeta(id);
  const base: TemplateConfig = {
    id,
    count1: meta.count1,
    count2: meta.count2,
    gapFt: keep?.gapFt ?? (unit === "METERS" ? 3 : 10),
    side: keep?.side ?? "RIGHT",
    pieces: [],
  };
  return { ...base, pieces: autoFillTemplatePieces(plotW, plotD, base) };
}

interface RectSpec {
  label: string;
  kind: "PLOT" | "REMAINDER";
  x: number;
  y: number;
  w: number;
  d: number;
}

/** Places every piece according to the template pattern. Pieces with 0 width / depth are skipped. */
export function buildTemplateRects(plotW: number, plotD: number, cfg: TemplateConfig, unit: MeasurementUnit = "FEET"): RectSpec[] {
  const u = unitShort(unit);
  const gap = num(cfg.gapFt);
  const slot = (i: number) => ({
    label: (cfg.pieces[i]?.label || "").trim().toUpperCase() || `PLOT ${i + 1}`,
    w: num(cfg.pieces[i]?.widthFt),
    d: num(cfg.pieces[i]?.depthFt),
  });
  const rects: RectSpec[] = [];
  const add = (i: number, x: number, y: number) => {
    const s = slot(i);
    if (s.w > 0 && s.d > 0) rects.push({ label: s.label, kind: "PLOT", x, y, w: s.w, d: s.d });
  };
  const c1 = cfg.count1;
  const c2 = cfg.count2;

  switch (cfg.id) {
    case "ROW": {
      let cx = 0;
      for (let i = 0; i < c1; i++) { add(i, cx, 0); cx += slot(i).w; }
      break;
    }
    case "STACK": {
      let cy = 0;
      for (let i = 0; i < c1; i++) { add(i, 0, cy); cy += slot(i).d; }
      break;
    }
    case "TWO_ROWS": {
      let cx = 0;
      for (let i = 0; i < c1; i++) { add(i, cx, 0); cx += slot(i).w; }
      cx = 0;
      for (let j = 0; j < c2; j++) { const s = slot(c1 + j); add(c1 + j, cx, plotD - s.d); cx += s.w; }
      break;
    }
    case "CORNER_L": {
      let cx = 0;
      for (let i = 0; i < c1; i++) { add(i, cx, 0); cx += slot(i).w; }
      const cornerIdx = cfg.side === "RIGHT" ? c1 - 1 : 0;
      const cornerD = slot(cornerIdx).d;
      let cy = cornerD;
      let colW = 0;
      for (let j = 0; j < c2; j++) {
        const s = slot(c1 + j);
        add(c1 + j, cfg.side === "RIGHT" ? plotW - s.w : 0, cy);
        cy += s.d;
        colW = Math.max(colW, s.w);
      }
      // Inner plot: the area enclosed by the top row and the side column
      add(c1 + c2, cfg.side === "RIGHT" ? 0 : colW, cornerD);
      break;
    }
    case "CENTRE_ROAD": {
      let leftW = 0;
      let cy = 0;
      for (let i = 0; i < c1; i++) { add(i, 0, cy); cy += slot(i).d; leftW = Math.max(leftW, slot(i).w); }
      if (gap > 0) rects.push({ label: `ROAD (${gap} ${u})`, kind: "REMAINDER", x: leftW, y: 0, w: gap, d: plotD });
      cy = 0;
      for (let j = 0; j < c2; j++) { add(c1 + j, leftW + gap, cy); cy += slot(c1 + j).d; }
      break;
    }
    case "REAR_PASSAGE": {
      let frontD = 0;
      let sumW = 0;
      for (let i = 0; i < c1; i++) { frontD = Math.max(frontD, slot(i).d); sumW += slot(i).w; }
      const startX = cfg.side === "LEFT" ? gap : 0;
      let cx = startX;
      for (let i = 0; i < c1; i++) { add(i, cx, 0); cx += slot(i).w; }
      if (gap > 0) rects.push({ label: `PASSAGE (${gap} ${u})`, kind: "REMAINDER", x: cfg.side === "LEFT" ? 0 : sumW, y: 0, w: gap, d: frontD });
      add(c1, 0, frontD);
      break;
    }
    case "GRID": {
      let cy = 0;
      for (let r = 0; r < c2; r++) {
        let cx = 0;
        let rowD = 0;
        for (let c = 0; c < c1; c++) {
          const i = r * c1 + c;
          add(i, cx, cy);
          cx += slot(i).w;
          rowD = Math.max(rowD, slot(i).d);
        }
        cy += rowD;
      }
      break;
    }
  }
  return rects;
}

export function buildTemplatePieces(plotW: number, plotD: number, cfg: TemplateConfig, unit: MeasurementUnit = "FEET"): PieceInfo[] {
  const rects = buildTemplateRects(plotW, plotD, cfg, unit);
  return polysToPieceInfos(rects.map((r) => ({ label: r.label, kind: r.kind, polygon: rectPoly(r.x, r.y, r.w, r.d) })));
}

/* =========================================================
   MANUAL MODE
========================================================= */

export type ManualShape = "RECT" | "L" | "TRAP" | "POLY";
export type ManualKind = "PLOT" | "OPEN" | "ROAD";
export type NotchCorner = "TL" | "TR" | "BL" | "BR";

export interface ManualPieceDef {
  uid: string;
  label: string;
  kind: ManualKind;
  shape: ManualShape;
  x: number; // offset of the piece's bounding box from the plot's left edge
  y: number; // offset of the piece's bounding box from the plot's top edge
  w: number; // RECT / L: width, TRAP: bottom width
  d: number; // depth / height
  notchW?: number; // L-shape: size of the removed corner
  notchD?: number;
  notchCorner?: NotchCorner;
  topW?: number; // TRAP: top width
  points?: Pt[]; // POLY: vertices in plot coordinates
}

export interface ManualConfig {
  pieces: ManualPieceDef[];
}

export function manualPolygon(def: ManualPieceDef): Pt[] | null {
  const x = Number(def.x) || 0;
  const y = Number(def.y) || 0;
  const w = num(def.w);
  const d = num(def.d);
  const shift = (poly: Pt[]) => poly.map((p) => ({ x: p.x + x, y: p.y + y }));

  switch (def.shape) {
    case "POLY": {
      const pts = (def.points || []).map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
      return pts.length >= 3 ? pts : null;
    }
    case "L": {
      if (w <= 0 || d <= 0) return null;
      const cw = Math.min(num(def.notchW), w - 0.01);
      const ch = Math.min(num(def.notchD), d - 0.01);
      if (cw <= 0 || ch <= 0) return shift(rectPoly(0, 0, w, d));
      return shift(lShapePlot(w, d, cw, ch, def.notchCorner || "TR"));
    }
    case "TRAP": {
      const top = num(def.topW) || w;
      if (w <= 0 || d <= 0 || top <= 0) return null;
      return shift(trapezoidPlot(top, w, d, d));
    }
    default:
      return w > 0 && d > 0 ? shift(rectPoly(0, 0, w, d)) : null;
  }
}

export function buildManualPieces(config: ManualConfig, unit: MeasurementUnit = "FEET"): PieceInfo[] {
  void unit;
  let plotNo = 0;
  let openNo = 0;
  const specs: PolySpec[] = [];
  for (const def of config.pieces || []) {
    const polygon = manualPolygon(def);
    if (!polygon) continue;
    const typed = (def.label || "").trim().toUpperCase();
    if (def.kind === "PLOT") {
      plotNo++;
      specs.push({ id: def.uid, label: typed || `PLOT ${plotNo}`, kind: "PLOT", polygon });
    } else if (def.kind === "ROAD") {
      specs.push({ id: def.uid, label: typed || "ROAD", kind: "REMAINDER", polygon });
    } else {
      openNo++;
      specs.push({ id: def.uid, label: typed || `OPEN ${openNo}`, kind: "REMAINDER", polygon });
    }
  }
  return polysToPieceInfos(specs);
}

export const newManualUid = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newManualPiece(plotW: number, plotD: number, shape: ManualShape = "RECT", kind: ManualKind = "PLOT"): ManualPieceDef {
  const w = r2(plotW / 2);
  const d = r2(plotD / 2);
  const base: ManualPieceDef = { uid: newManualUid(), label: "", kind, shape, x: 0, y: 0, w, d };
  if (shape === "L") return { ...base, notchW: r2(w / 2), notchD: r2(d / 2), notchCorner: "TR" };
  if (shape === "TRAP") return { ...base, topW: r2(w * 0.6) };
  if (shape === "POLY") {
    return { ...base, points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }] };
  }
  return base;
}

/* =========================================================
   Entry point used by the preview page
========================================================= */

export function generateCustomLayoutPieces(plotW: number, plotD: number, config: any, unit: MeasurementUnit = "FEET"): PieceInfo[] {
  if (!config) return [];
  if (config.mode === "TEMPLATE" && config.template) return buildTemplatePieces(plotW, plotD, config.template as TemplateConfig, unit);
  if (config.mode === "MANUAL" && config.manual) return buildManualPieces(config.manual as ManualConfig, unit);
  return [];
}
