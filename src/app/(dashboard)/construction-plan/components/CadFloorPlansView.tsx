import React, { useState } from "react";
import { formatDim, renderSideDim } from "./CadDimUtils";
import { placeRoomLabel, buildNameVariants, doorSwingBox, Box } from "../engine/labelPlacer";
import { FloorData, FloorRoom, PlacedDoor, PlacedWindow } from "../engine/planningTypes";
import { validateConstructionPlan, RenderedRoomBox } from "../engine/validationEngine";

const cadDiagnosticCache = new Set<string>();
const cadValidationCache = new Set<string>();
const cadStairDebugCache = new Set<string>();

interface StaircaseConfig {
  treadCount?: number;
  landingDepth?: number;
  wellGapFt?: number;
  wallThicknessInch?: number;
  landingLabel?: string;
  staircaseType?: string;
  staircaseSpec?: any;
  [key: string]: any;
}

interface CadFloorPlansViewProps {
  processedFloors: string[];
  itemsPerRow: number;
  plotGap: number;
  baseBuiltUpWidth: number;
  interFloorGap: number;
  rowHeightGap: number;
  scale: number;
  getFloorPoints: (floorName: string) => { x: number; y: number }[];
  floorBuiltUpAreas?: { [key: string]: number };
  baseArea?: number;
  floorData: Record<string, FloorData | any>;
  floorRooms?: Record<string, Record<string, FloorRoom> | FloorRoom[]>;
  roadOrientation?: "NORTH" | "SOUTH" | "EAST" | "WEST";
  measurementUnit?: "FEET" | "METERS";
  MANUAL_TOWER_DIM_X_OFFSET?: number;
  MANUAL_TOWER_DIM_Y_OFFSET?: number;
}

export default function CadFloorPlansView({
  processedFloors,
  itemsPerRow,
  plotGap,
  baseBuiltUpWidth,
  interFloorGap,
  rowHeightGap,
  scale,
  getFloorPoints,
  floorData,
  floorRooms = {},
  roadOrientation = "SOUTH",
  measurementUnit,
  baseArea,
}: CadFloorPlansViewProps) {

  const [showValidationBanner, setShowValidationBanner] = useState(false);

  const getFloorInfo = (name: string) => {
    if (!floorData) return null;
    const cleanKey = name.trim().toLowerCase();
    const foundKey = Object.keys(floorData).find(
      (k) => k.trim().toLowerCase() === cleanKey || k.trim().toLowerCase().replace(/\s+/g, "_") === cleanKey.replace(/\s+/g, "_")
    );
    return foundKey ? floorData[foundKey] : null;
  };

  const getSmartLabel = (name: string, rwFt: number) => {
    if (rwFt < 4.5) {
      if (name.includes("MASTER BEDROOM")) return "M.BED";
      if (name.includes("BEDROOM")) return "BED";
      if (name.includes("COMMON BATHROOM") || name.includes("COMMON BATH")) return "C.BATH";
      if (name.includes("ATTACHED BATHROOM") || name.includes("ATTACHED TOILET")) return "A.BATH";
      if (name.includes("VENTILATION SHAFT") || name.includes("OTS / DUCT") || name.includes("OTS")) return "DUCT";
      if (name.includes("PARKING")) return "PARK";
      if (name.includes("KITCHEN")) return "KIT";
      if (name.includes("DRAWING")) return "HALL";
      if (name.includes("BALCONY")) return "BALC";
    }
    if (rwFt < 8.0) {
      if (name.includes("VENTILATION SHAFT / OTS")) return "VENT DUCT";
      if (name.includes("CAR PARKING / PORCH")) return "PARKING";
      if (name.includes("KITCHEN & DINING")) return "KITCHEN / DINING";
      if (name.includes("FORMAL DRAWING ROOM")) return "DRAWING ROOM";
      if (name.includes("FAMILY LIVING & DINING")) return "LIVING / DINING";
      if (name.includes("BEDROOM 2 (GUEST)")) return "BEDROOM 2";
      if (name.includes("ATTACHED BATH & DRESS")) return "ATT. BATH";
    }
    return name;
  };

  const stairFloorHeightFt: number = (() => {
    const infos: any[] = Object.values(floorData || {});
    for (const f of infos) {
      const v = Number(
        f?.floorToFloorHeightFeet ??
        f?.planningSettings?.floorToFloorHeightFeet ??
        f?.settings?.floorToFloorHeightFeet ??
        f?.staircaseConfig?.floorToFloorHeightFeet
      );
      if (v > 0) return v;
    }
    return 10;
  })();

  const renderEngineStaircase = (
    x: number, y: number, w: number, h: number,
    stairConfig?: StaircaseConfig
  ) => {
    const preCalcSpec = (stairConfig as any)?.staircaseSpec || {};

    const stairType = String(
      preCalcSpec?.staircaseType ||
      (stairConfig as any)?.staircaseType ||
      "2_QUARTER_LANDING"
    ).toUpperCase();

    const renderCShape = () => {
      const floorHeightFt =
        Number(preCalcSpec?.floorToFloorHeightFeet || preCalcSpec?.floorHeightFt || preCalcSpec?.floorHeightFeet) ||
        stairFloorHeightFt || 10;
      const floorHeightIn = floorHeightFt * 12;
      const MAX_RISER_IN = 7;
      const MIN_TREAD_IN = 10;

      const specRisers = Number(preCalcSpec?.riserCount);
      const specRiserIn = specRisers > 0 ? floorHeightIn / specRisers : 0;

      let riserCount: number;
      if (specRisers > 0 && specRiserIn >= 5 && specRiserIn <= 7.5) {
        riserCount = specRisers;
      } else {
        riserCount = Math.ceil(floorHeightIn / MAX_RISER_IN);
      }
      riserCount = Math.max(17, riserCount);

      const riserIn = floorHeightIn / riserCount;
      const minTreadIn = Math.max(MIN_TREAD_IN, Number(preCalcSpec?.treadInches) || MIN_TREAD_IN);
      const requiredTreads = Math.max(3, riserCount - 3);

      const boxWft = w / scale;
      const boxHft = h / scale;
      const G = Math.min(3.0, Math.max(2.5, Number(preCalcSpec?.landing1WidthFt) || 3.0), boxWft * 0.5);
      const flightLenFt = Math.max(0, boxWft - G);
      const middleLenFt = Math.max(0, boxHft - 2 * G);

      const flightCap = Math.floor((flightLenFt * 12) / minTreadIn);
      const middleCap = Math.floor((middleLenFt * 12) / minTreadIn);

      const f1 = Math.min(flightCap, Math.ceil(requiredTreads / 3));
      const f2 = Math.min(flightCap, Math.ceil((requiredTreads - f1) / 2));
      let m = Math.max(0, requiredTreads - f1 - f2);
      let shortBy = 0;
      if (m > middleCap) { shortBy = m - middleCap; m = middleCap; }

      const col1W = G * scale;
      const col2W = Math.max(0, w - col1W);
      const rowGH = G * scale;
      const row2H = Math.max(0, h - 2 * rowGH);

      const row1Y = y;
      const row2Y = y + rowGH;
      const row3Y = y + rowGH + row2H;

      const flight1TreadStep = col2W / Math.max(1, f1);
      const flight2TreadStep = col2W / Math.max(1, f2);
      const middleTreadStep = row2H / Math.max(1, m);

      const flightTreadIn = f1 > 0 ? (flightLenFt * 12) / f1 : 0;
      const middleTreadIn = m > 0 ? (middleLenFt * 12) / m : 0;
      const fs = Math.max(1.5, Math.min(2.4, scale * 0.4));

      void stairType;

      return (
        <g id="c-shape-stair">
          {/* ROW 1 — 1st landing + flight 1 */}
          <rect x={x} y={row1Y} width={col1W} height={rowGH} fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
          <text x={x + col1W / 2} y={row1Y + rowGH / 2} fill="#38bdf8" fontSize={Math.min(2.5, col1W * 0.12)} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
            {col1W > 8 ? "1ST LANDING" : "1ST LNDG"}
          </text>
          <rect x={x + col1W} y={row1Y} width={col2W} height={rowGH} fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          {Array.from({ length: Math.max(0, f1 - 1) }).map((_, i) => (
            <line key={`f1-${i}`} x1={x + col1W + ((i + 1) * flight1TreadStep)} y1={row1Y} x2={x + col1W + ((i + 1) * flight1TreadStep)} y2={row1Y + rowGH} stroke="#38bdf8" strokeWidth="0.4" />
          ))}
          <circle cx={x + col1W + col2W - 2} cy={row1Y + rowGH / 2} r="0.9" fill="#eab308" />
          <g transform={`translate(${x + col1W + col2W / 2}, ${row1Y + rowGH / 2})`}>
            <line x1="-3" y1="0" x2="3" y2="0" stroke="#eab308" strokeWidth="0.7" />
            <polygon points="-4.5,0 -1,-1.5 -1,1.5" fill="#eab308" />
          </g>

          {/* ROW 2 — middle flight + well */}
          <rect x={x} y={row2Y} width={col1W} height={row2H} fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          {Array.from({ length: Math.max(0, m - 1) }).map((_, i) => (
            <line key={`mid-${i}`} x1={x} y1={row2Y + ((i + 1) * middleTreadStep)} x2={x + col1W} y2={row2Y + ((i + 1) * middleTreadStep)} stroke="#38bdf8" strokeWidth="0.4" />
          ))}
          <rect x={x + col1W} y={row2Y} width={col2W} height={row2H} fill="none" stroke="#38bdf8" strokeWidth="0.3" strokeDasharray="2,2" />
          <text x={x + col1W + col2W / 2} y={row2Y + row2H / 2 - fs * 0.9} fill="#38bdf8" fontSize={fs} textAnchor="middle" dominantBaseline="middle" fontWeight="600">
            {`${riserCount} R @ ${riserIn.toFixed(1)}"`}
          </text>
          <text x={x + col1W + col2W / 2} y={row2Y + row2H / 2 + fs * 0.4} fill="#38bdf8" fontSize={fs} textAnchor="middle" dominantBaseline="middle" fontWeight="600">
            {`T ${flightTreadIn.toFixed(1)}" / ${middleTreadIn.toFixed(1)}"`}
          </text>
          {shortBy > 0 && (
            <text x={x + col1W + col2W / 2} y={row2Y + row2H / 2 + fs * 1.9} fill="#f87171" fontSize={fs * 0.9} textAnchor="middle" dominantBaseline="middle" fontWeight="700">
              {`SHORT ${shortBy} TREAD`}
            </text>
          )}

          {/* ROW 3 — 2nd landing + flight 2 */}
          <rect x={x} y={row3Y} width={col1W} height={rowGH} fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
          <text x={x + col1W / 2} y={row3Y + rowGH / 2} fill="#38bdf8" fontSize={Math.min(2.5, col1W * 0.12)} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
            {col1W > 8 ? "2ND LANDING" : "2ND LNDG"}
          </text>
          <rect x={x + col1W} y={row3Y} width={col2W} height={rowGH} fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          {Array.from({ length: Math.max(0, f2 - 1) }).map((_, i) => (
            <line key={`f2-${i}`} x1={x + col1W + ((i + 1) * flight2TreadStep)} y1={row3Y} x2={x + col1W + ((i + 1) * flight2TreadStep)} y2={row3Y + rowGH} stroke="#38bdf8" strokeWidth="0.4" />
          ))}
          <g transform={`translate(${x + col1W + col2W / 2}, ${row3Y + rowGH / 2})`}>
            <line x1="-3" y1="0" x2="3" y2="0" stroke="#eab308" strokeWidth="0.7" />
            <polygon points="4.5,0 1,-1.5 1,1.5" fill="#eab308" />
          </g>
        </g>
      );
    };

    return (
      <g id="engine-validated-staircase">
        {renderCShape()}
      </g>
    );
  };

  const GATE_SIDE_GAP_FT = 0.5;

  const isParkingGateDoor = (d: any): boolean => {
    const id = String(d?.id || "").toLowerCase();
    const role = String(d?.entryRole || "").toLowerCase();
    return (id.includes("parking") && id.includes("gate")) || role.includes("main_road_vehicle_gate");
  };

  const resolveOpeningSpan = (o: any, wallLenFt: number) => {
    const width0 = Math.max(0, Number(o?.widthFeet ?? o?.lengthFeet ?? 0));
    const off0 = Math.max(0, Number(o?.offsetFeet || 0));
    if (!isParkingGateDoor(o) || wallLenFt <= 0) return { offsetFeet: off0, widthFeet: width0 };
    const width = Math.max(2.5, Math.min(width0 || wallLenFt, wallLenFt - 2 * GATE_SIDE_GAP_FT));
    const offset = Math.max(GATE_SIDE_GAP_FT, (wallLenFt - width) / 2);
    return { offsetFeet: offset, widthFeet: width };
  };

  const normalizeRoomList = (input: any[], W: number, H: number): any[] => {
    const EPS = 0.2;
    const rooms: any[] = input.map((r: any) => ({
      ...r,
      doors: Array.isArray(r.doors) ? r.doors.map((d: any) => ({ ...d })) : [],
      windows: Array.isArray(r.windows) ? r.windows.map((w: any) => ({ ...w })) : [],
    }));

    const up = (r: any) => String(r?.name || "").toUpperCase();
    const has = (r: any, ...keys: string[]) => keys.some((k) => up(r).includes(k));
    const isStair = (r: any) => r.type === "stairs" || has(r, "STAIR");
    const isHall = (r: any) => has(r, "LIVING", "HALL", "DRAWING") && !isStair(r) && !has(r, "KITCHEN");
    const isCirc = (r: any) => (has(r, "PASSAGE", "CORRIDOR", "LIVING", "HALL", "DRAWING", "DINING")) && !isStair(r) && !has(r, "KITCHEN");
    const xOv = (a: any, b: any) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const yOv = (a: any, b: any) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const overlaps = (a: any, b: any) => xOv(a, b) > 0.05 && yOv(a, b) > 0.05;
    const contains = (p: any, r: any) =>
      r.x >= p.x - 0.05 && r.y >= p.y - 0.05 && r.x + r.w <= p.x + p.w + 0.05 && r.y + r.h <= p.y + p.h + 0.05 && p.w * p.h > r.w * r.h + 0.5;
    const onBoundary = (r: any, wall: string) =>
      wall === "TOP" ? r.y <= EPS :
      wall === "BOTTOM" ? r.y + r.h >= H - EPS :
      wall === "LEFT" ? r.x <= EPS :
      r.x + r.w >= W - EPS;
    const OPP: Record<string, string> = { TOP: "BOTTOM", BOTTOM: "TOP", LEFT: "RIGHT", RIGHT: "LEFT" };

    const addDoor = (room: any, wall: string, nb: any, width: number, tag: string) => {
      const horizontal = wall === "TOP" || wall === "BOTTOM";
      const r0 = horizontal ? room.x : room.y;
      const lo = Math.max(r0, horizontal ? nb.x : nb.y);
      const hi = Math.min(r0 + (horizontal ? room.w : room.h), horizontal ? nb.x + nb.w : nb.y + nb.h);
      const span = hi - lo;
      if (span < 2.4) return;
      const w = Math.min(width, Math.max(2.5, span - 1));
      const start = lo + Math.max(0.5, (span - w) / 2);
      const id = `shared-norm-${tag}-${String(room.id ?? room.name)}`;
      room.doors.push({
        id, sharedOpeningId: id, wall, offsetFeet: Number((start - r0).toFixed(3)), widthFeet: w,
        heightFeet: 7, swingInside: true, hingeSide: "START", renderSymbol: true, doorType: "INTERNAL",
      });
    };

    const hasDoorBetween = (room: any, wall: string, nb: any) => {
      const horizontal = wall === "TOP" || wall === "BOTTOM";
      const r0 = horizontal ? room.x : room.y;
      const lo = Math.max(r0, horizontal ? nb.x : nb.y);
      const hi = Math.min(r0 + (horizontal ? room.w : room.h), horizontal ? nb.x + nb.w : nb.y + nb.h);
      const covers = (owner: any, ownWall: string, d: any) => {
        if (d.wall !== ownWall || d.renderSymbol === false) return false;
        const g0 = (horizontal ? owner.x : owner.y) + Number(d.offsetFeet || 0);
        const g1 = g0 + Number(d.widthFeet ?? 0);
        return g1 > lo + 0.05 && g0 < hi - 0.05;
      };
      return room.doors.some((d: any) => covers(room, wall, d)) || nb.doors.some((d: any) => covers(nb, OPP[wall], d));
    };

    // ---------- A) align PARKING / KITCHEN band tops ----------
    const band = rooms.filter((r) => !isStair(r) && Math.abs(r.y + r.h - H) <= EPS && has(r, "PARKING", "KITCHEN"));
    if (band.length >= 2) {
      const topY = Math.min(...band.map((r) => r.y));
      band.forEach((r) => {
        if (r.y <= topY + 0.05) return;
        const strip = { x: r.x, y: topY, w: r.w, h: r.y - topY };
        if (rooms.some((o) => o !== r && overlaps(strip, o))) return;
        const delta = r.y - topY;
        r.h += delta; r.y = topY;
        [...r.doors, ...r.windows].forEach((o: any) => {
          if (o.wall === "LEFT" || o.wall === "RIGHT") o.offsetFeet = Number(o.offsetFeet || 0) + delta;
        });
      });
    }

    // ---------- B) hall absorbs the leftover gap below it ----------
    rooms.filter(isHall).forEach((h) => {
      const bottom = h.y + h.h;
      if (bottom >= H - EPS) return;
      let limit = H;
      rooms.forEach((o) => { if (o !== h && xOv(h, o) > 0.12 && o.y >= bottom - 0.05) limit = Math.min(limit, o.y); });
      const gap = limit - bottom;
      if (limit >= H - EPS || gap <= 0.05 || gap > 8) return;
      const strip = { x: h.x, y: bottom, w: h.w, h: gap };
      if (rooms.some((o) => o !== h && overlaps(strip, o))) return;
      h.h += gap;
      h.doors = h.doors.filter((d: any) => d.wall !== "BOTTOM");
      h.windows = h.windows.filter((w: any) => w.wall !== "BOTTOM");
    });

    // ---------- E) narrow bedroom => horizontal attached bath at the entry side ----------
    rooms.filter((r) => has(r, "ATTACHED") || (has(r, "BATH", "TOILET") && !has(r, "COMMON"))).forEach((b) => {
      const parent = rooms.find((p) => p !== b && has(p, "BEDROOM") && contains(p, b));
      if (!parent || parent.w > 12.01 || b.h <= b.w) return;
      const below = rooms.some((o) => o !== parent && isCirc(o) && Math.abs(parent.y + parent.h - o.y) <= 0.25 && xOv(parent, o) >= 2.5);
      const above = rooms.some((o) => o !== parent && isCirc(o) && Math.abs(o.y + o.h - parent.y) <= 0.25 && xOv(parent, o) >= 2.5);
      const entry = below ? "BOTTOM" : above ? "TOP" : null;
      if (!entry) return;
      const bw = Math.min(parent.w - 3.5, Math.max(5, Math.round(parent.w * 0.55 * 4) / 4));
      if (bw < 4) return;
      const area = Math.max(b.w * b.h, 30);
      const bh = Math.min(5, Math.max(4.5, Math.ceil((area / bw) * 4) / 4));
      if (parent.h - bh < 4) return;
      b.w = bw; b.h = bh; b.x = parent.x;
      b.y = entry === "BOTTOM" ? parent.y + parent.h - bh : parent.y;
      b.doors = [];
      const doorWall = entry === "BOTTOM" ? "TOP" : "BOTTOM";
      const dw = 2.5;
      const id = `shared-norm-bath-door-${String(b.id ?? b.name)}`;
      b.doors.push({ id, sharedOpeningId: id, wall: doorWall, offsetFeet: Number(((bw - dw) / 2).toFixed(2)), widthFeet: dw, heightFeet: 7, swingInside: true, hingeSide: "START", renderSymbol: true, doorType: "INTERNAL" });
      b.windows = b.windows.filter((w: any) => onBoundary(b, w.wall));
      if (b.windows.length === 0) {
        const wall = (["LEFT", "RIGHT", "TOP", "BOTTOM"] as const).find((s) => onBoundary(b, s));
        if (wall) {
          const len = wall === "TOP" || wall === "BOTTOM" ? b.w : b.h;
          b.windows.push({ id: `norm-bath-vent-${String(b.id ?? b.name)}`, wall, offsetFeet: Number(((len - 1.5) / 2).toFixed(2)), lengthFeet: 1.5, widthFeet: 1.5, type: "VENTILATOR" });
        }
      }
    });

    // ---------- D) private-room doors must never open to the outside ----------
    const isPrivate = (r: any) => has(r, "BEDROOM", "BATH", "TOILET", "DRESS", "STORE", "POOJA", "STUDY") && !has(r, "PARKING");
    const bestInterval = (lo: number, hi: number, forbidden: [number, number][], need: number): [number, number] | null => {
      const sorted = forbidden.filter((f) => f[1] > lo && f[0] < hi).sort((a, b) => a[0] - b[0]);
      let cur = lo; let best: [number, number] | null = null;
      const consider = (a: number, b: number) => { if (b - a >= need && (!best || b - a > best[1] - best[0])) best = [a, b]; };
      for (const [f0, f1] of sorted) { consider(cur, Math.min(f0, hi)); cur = Math.max(cur, f1); }
      consider(cur, hi);
      return best;
    };

    rooms.filter(isPrivate).forEach((r) => {
      const parent = rooms.find((p) => p !== r && has(p, "BEDROOM") && contains(p, r));
      const subs = rooms.filter((s) => s !== r && !isStair(s) && contains(r, s));
      r.doors.forEach((d: any) => {
        if (!onBoundary(r, d.wall)) return;
        const dw = Math.min(Number(d.widthFeet) || 3, 3);
        let pick: { wall: string; a: number; b: number; score: number } | null = null;

        (["BOTTOM", "TOP", "LEFT", "RIGHT"] as const).forEach((wall) => {
          if (onBoundary(r, wall)) return;
          const horizontal = wall === "TOP" || wall === "BOTTOM";
          const r0 = horizontal ? r.x : r.y;
          const r1 = r0 + (horizontal ? r.w : r.h);
          const fixed = wall === "TOP" ? r.y : wall === "BOTTOM" ? r.y + r.h : wall === "LEFT" ? r.x : r.x + r.w;
          const forbidden: [number, number][] = subs
            .filter((s) => (wall === "TOP" ? s.y - r.y : wall === "BOTTOM" ? r.y + r.h - (s.y + s.h) : wall === "LEFT" ? s.x - r.x : r.x + r.w - (s.x + s.w)) < 1.2)
            .map((s) => (horizontal ? [s.x - 0.25, s.x + s.w + 0.25] : [s.y - 0.25, s.y + s.h + 0.25]) as [number, number]);

          if (parent) {
            const depth = wall === "TOP" ? r.y - parent.y : wall === "BOTTOM" ? parent.y + parent.h - (r.y + r.h) : wall === "LEFT" ? r.x - parent.x : parent.x + parent.w - (r.x + r.w);
            if (depth < 2.5) return;
            const itv = bestInterval(r0, r1, forbidden, dw + 0.4);
            if (itv && (!pick || depth > pick.score)) pick = { wall, a: itv[0], b: itv[1], score: depth };
            return;
          }
          rooms.forEach((o) => {
            if (o === r || !isCirc(o)) return;
            const adjacent = wall === "TOP" ? Math.abs(o.y + o.h - fixed) <= 0.25 : wall === "BOTTOM" ? Math.abs(o.y - fixed) <= 0.25 : wall === "LEFT" ? Math.abs(o.x + o.w - fixed) <= 0.25 : Math.abs(o.x - fixed) <= 0.25;
            if (!adjacent) return;
            const lo = Math.max(r0, horizontal ? o.x : o.y);
            const hi = Math.min(r1, horizontal ? o.x + o.w : o.y + o.h);
            const itv = bestInterval(lo, hi, forbidden, dw + 0.6);
            if (!itv) return;
            const score = (has(o, "PASSAGE") ? 100 : 0) + (itv[1] - itv[0]);
            if (!pick || score > pick.score) pick = { wall, a: itv[0], b: itv[1], score };
          });
        });

        if (pick) {
          const p = pick as { wall: string; a: number; b: number; score: number };
          const horizontal = p.wall === "TOP" || p.wall === "BOTTOM";
          const start = p.a + Math.max(0.3, (p.b - p.a - dw) / 2);
          d.wall = p.wall;
          d.widthFeet = dw;
          d.offsetFeet = Number((start - (horizontal ? r.x : r.y)).toFixed(3));
          d.swingInside = true;
          d.renderSymbol = true;
          d.sharedOpeningId = `shared-reloc-${String(d.id || "door")}`;
        }
      });
    });

    // ---------- C) gate/door on PARKING <-> HALL partition (+ kitchen door) ----------
    rooms.filter((r) => has(r, "PARKING")).forEach((p) => {
      const hall = rooms.find((h) => isCirc(h) && Math.abs(h.y + h.h - p.y) <= 0.25 && xOv(h, p) >= 3);
      if (hall && !hasDoorBetween(p, "TOP", hall)) addDoor(p, "TOP", hall, 3, "parking-hall");
    });
    rooms.filter((r) => has(r, "KITCHEN") && !isStair(r)).forEach((k) => {
      if (k.doors.length > 0) return;
      const hall = rooms.find((h) => isCirc(h) && Math.abs(h.y + h.h - k.y) <= 0.25 && xOv(h, k) >= 2.5);
      if (hall && !hasDoorBetween(k, "TOP", hall)) addDoor(k, "TOP", hall, 2.5, "kitchen-hall");
    });

    rooms.forEach((r) => r.doors.forEach((d: any) => { d.__onBoundary = onBoundary(r, d.wall); }));

    return rooms;
  };

  const renderCadDoorSymbol = (door: PlacedDoor, rx: number, ry: number, rw: number, rh: number, keyStr: string) => {
    const d = door as any;

    const isParkingGate = isParkingGateDoor(d);
    const wallLenFt = (door.wall === 'BOTTOM' || door.wall === 'TOP') ? rw / scale : rh / scale;
    const resolvedSpan = resolveOpeningSpan(d, wallLenFt);
    const effectiveWidthFeet = resolvedSpan.widthFeet || door.widthFeet;
    const dw = effectiveWidthFeet * scale;
    const offset = resolvedSpan.offsetFeet * scale;

    const externalWallThickPx = (isParkingGate || d.__onBoundary) ? (4 / 12) * scale : 0;

    const isDouble = Boolean(d.isDoubleLeaf || d.doubleLeaf || (d.leafCount && d.leafCount > 1) || d.doorType === "MAIN");
    const swingInside = Boolean(d.swingInside);

    let dx = rx;
    let dy = ry;
    let shutterPath = "";
    let arcPath = "";

    if (isDouble) {
      const hw = dw / 2;
      if (door.wall === "BOTTOM") {
        dx = rx + offset;
        dy = ry + rh + externalWallThickPx;
        shutterPath = `M ${dx} ${dy} L ${dx} ${dy - hw} M ${dx + dw} ${dy} L ${dx + dw} ${dy - hw}`;
        arcPath = `M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 0 ${dx} ${dy - hw} M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 1 ${dx + dw} ${dy - hw}`;
      } else if (door.wall === "TOP") {
        dx = rx + offset; dy = ry;
        shutterPath = `M ${dx} ${dy} L ${dx} ${dy + hw} M ${dx + dw} ${dy} L ${dx + dw} ${dy + hw}`;
        arcPath = `M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 1 ${dx} ${dy + hw} M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 0 ${dx + dw} ${dy + hw}`;
      } else if (door.wall === "LEFT") {
        dx = rx; dy = ry + offset;
        shutterPath = `M ${dx} ${dy} L ${dx + hw} ${dy} M ${dx} ${dy + dw} L ${dx + hw} ${dy + dw}`;
        arcPath = `M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 0 ${dx + hw} ${dy} M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 1 ${dx + hw} ${dy + dw}`;
      } else {
        dx = rx + rw; dy = ry + offset;
        shutterPath = `M ${dx} ${dy} L ${dx - hw} ${dy} M ${dx} ${dy + dw} L ${dx - hw} ${dy + dw}`;
        arcPath = `M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 1 ${dx - hw} ${dy} M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 0 ${dx - hw} ${dy + dw}`;
      }
    } else {
      const hingeEnd = String(d.hingeSide || "").toUpperCase() === "END";

      if (door.wall === "BOTTOM") {
        dx = rx + offset;
        dy = ry + rh + externalWallThickPx;
        if (hingeEnd) {
          shutterPath = `M ${dx + dw} ${dy} L ${dx + dw} ${dy - dw}`;
          arcPath = `M ${dx} ${dy} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy - dw}`;
        } else {
          shutterPath = `M ${dx} ${dy} L ${dx} ${dy - dw}`;
          arcPath = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 0 ${dx} ${dy - dw}`;
        }
      } else if (door.wall === "TOP") {
        dx = rx + offset; dy = ry;
        if (hingeEnd) {
          shutterPath = `M ${dx + dw} ${dy} L ${dx + dw} ${dy + dw}`;
          arcPath = `M ${dx} ${dy} A ${dw} ${dw} 0 0 0 ${dx + dw} ${dy + dw}`;
        } else {
          shutterPath = `M ${dx} ${dy} L ${dx} ${dy + dw}`;
          arcPath = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 1 ${dx} ${dy + dw}`;
        }
      } else if (door.wall === "LEFT") {
        dx = rx; dy = ry + offset;
        if (swingInside) {
          if (hingeEnd) {
            shutterPath = `M ${dx} ${dy + dw} L ${dx + dw} ${dy + dw}`;
            arcPath = `M ${dx} ${dy} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy + dw}`;
          } else {
            shutterPath = `M ${dx} ${dy} L ${dx + dw} ${dy}`;
            arcPath = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 0 ${dx + dw} ${dy}`;
          }
        } else {
          shutterPath = `M ${dx} ${dy} L ${dx - dw} ${dy}`;
          arcPath = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 1 ${dx - dw} ${dy}`;
        }
      } else {
        dx = rx + rw; dy = ry + offset;
        if (swingInside) {
          if (hingeEnd) {
            shutterPath = `M ${dx} ${dy + dw} L ${dx - dw} ${dy + dw}`;
            arcPath = `M ${dx} ${dy} A ${dw} ${dw} 0 0 0 ${dx - dw} ${dy + dw}`;
          } else {
            shutterPath = `M ${dx} ${dy} L ${dx - dw} ${dy}`;
            arcPath = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 1 ${dx - dw} ${dy}`;
          }
        } else {
          shutterPath = `M ${dx} ${dy} L ${dx + dw} ${dy}`;
          arcPath = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy}`;
        }
      }
    }

    return (
      <g key={keyStr} id="cad-door-symbol">
        <path d={arcPath} fill="none" stroke="#eab308" strokeWidth="0.5" strokeDasharray="1.5,1.5" />
        <path d={shutterPath} stroke="#eab308" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    );
  };

  const renderCadWindowSymbol = (win: PlacedWindow, rx: number, ry: number, rw: number, rh: number, keyStr: string) => {
    const ww = win.lengthFeet * scale;
    const offset = win.offsetFeet * scale;
    const wallThick = (4 / 12) * scale;

    let wx = rx, wy = ry;
    const isHorizontal = win.wall === "TOP" || win.wall === "BOTTOM";

    if (win.wall === "BOTTOM") { wx = rx + offset; wy = ry + rh - wallThick / 2; }
    else if (win.wall === "TOP") { wx = rx + offset; wy = ry - wallThick / 2; }
    else if (win.wall === "LEFT") { wx = rx - wallThick / 2; wy = ry + offset; }
    else { wx = rx + rw - wallThick / 2; wy = ry + offset; }

    if (isHorizontal) {
      return (
        <g key={keyStr} id="cad-window-symbol">
          <rect x={wx} y={wy} width={ww} height={wallThick} fill="#020617" stroke="#ffffff" strokeWidth="0.4" />
          <line x1={wx} y1={wy + wallThick * 0.3} x2={wx + ww} y2={wy + wallThick * 0.3} stroke="#38bdf8" strokeWidth="0.6" />
          <line x1={wx} y1={wy + wallThick * 0.7} x2={wx + ww} y2={wy + wallThick * 0.7} stroke="#38bdf8" strokeWidth="0.6" />
        </g>
      );
    }
    return (
      <g key={keyStr} id="cad-window-symbol">
        <rect x={wx} y={wy} width={wallThick} height={ww} fill="#020617" stroke="#ffffff" strokeWidth="0.4" />
        <line x1={wx + wallThick * 0.3} y1={wy} x2={wx + wallThick * 0.3} y2={wy + ww} stroke="#38bdf8" strokeWidth="0.6" />
        <line x1={wx + wallThick * 0.7} y1={wy} x2={wx + wallThick * 0.7} y2={wy + ww} stroke="#38bdf8" strokeWidth="0.6" />
      </g>
    );
  };

  const renderPartitionWalls = (
    roomList: any[],
    clearInnerWFt: number,
    clearInnerHFt: number,
    originX: number,
    originY: number,
  ) => {
    const wallThick = (4 / 12) * scale;
    const halfWall = wallThick / 2;
    const EDGE_EPS = 0.16;
    const TOUCH_EPS = 0.25;
    const LINE = 0.32;
    const OUTLINE = "#ef4444";
    const FILL = "#020617";

    type Side = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
    type Seg = { horizontal: boolean; fixed: number; start: number; end: number; room: any; side: Side; others: any[] };

    const isOpenArea = (r: any) => {
      const n = String(r?.name || "").toUpperCase();
      return Boolean(r?.isOpen) || n.includes("OPEN TERRACE") || n === "PASSAGE";
    };

    const subtractIntervals = (a: number, b: number, cuts: [number, number][]) => {
      const sorted = cuts.filter((c) => c[1] > a && c[0] < b).sort((p, q) => p[0] - q[0]);
      const out: [number, number][] = [];
      let cur = a;
      for (const [c0, c1] of sorted) {
        if (c0 > cur + 0.02) out.push([cur, Math.min(c0, b)]);
        cur = Math.max(cur, c1);
      }
      if (cur < b - 0.02) out.push([cur, b]);
      return out.filter(([s, e]) => e - s > 0.05);
    };

    const segs: Seg[] = [];
    const internalAudit: any[] = [];
    const sides: Side[] = ["TOP", "BOTTOM", "LEFT", "RIGHT"];

    for (const room of roomList) {
      for (const side of sides) {
        const horizontal = side === "TOP" || side === "BOTTOM";
        const isExterior =
          (side === "TOP" && Math.abs(room.y) <= EDGE_EPS) ||
          (side === "BOTTOM" && Math.abs(room.y + room.h - clearInnerHFt) <= EDGE_EPS) ||
          (side === "LEFT" && Math.abs(room.x) <= EDGE_EPS) ||
          (side === "RIGHT" && Math.abs(room.x + room.w - clearInnerWFt) <= EDGE_EPS);
        if (isExterior) continue;

        const r0 = horizontal ? room.x : room.y;
        const r1 = r0 + (horizontal ? room.w : room.h);
        const fixed = side === "TOP" ? room.y : side === "BOTTOM" ? room.y + room.h : side === "LEFT" ? room.x : room.x + room.w;

        const neighbors: { room: any; lo: number; hi: number }[] = [];
        for (const other of roomList) {
          if (other === room) continue;
          const adjacent =
            side === "TOP" ? Math.abs(other.y + other.h - room.y) <= TOUCH_EPS :
            side === "BOTTOM" ? Math.abs(other.y - (room.y + room.h)) <= TOUCH_EPS :
            side === "LEFT" ? Math.abs(other.x + other.w - room.x) <= TOUCH_EPS :
            Math.abs(other.x - (room.x + room.w)) <= TOUCH_EPS;
          if (!adjacent) continue;
          const lo = Math.max(r0, horizontal ? other.x : other.y);
          const hi = Math.min(r1, horizontal ? other.x + other.w : other.y + other.h);
          if (hi - lo > 0.12) neighbors.push({ room: other, lo, hi });
        }

        const openCuts: [number, number][] = isOpenArea(room)
          ? neighbors.filter((n) => isOpenArea(n.room)).map((n) => [n.lo, n.hi] as [number, number])
          : [];

        subtractIntervals(r0, r1, openCuts).forEach(([s, e]) => {
          const others = neighbors.filter((n) => n.hi > s + 0.02 && n.lo < e - 0.02).map((n) => n.room);
          segs.push({ horizontal, fixed, start: s, end: e, room, side, others });
          internalAudit.push({ room: room.name, other: others[0]?.name || "OPEN / UNASSIGNED", side, length: Number((e - s).toFixed(2)), openingCount: 0 });
        });
      }
    }

    const endKind = (s: Seg, atStart: boolean): "BOUNDARY" | "PERP" | "COLLINEAR" | "FREE" => {
      const pos = atStart ? s.start : s.end;
      const lim = s.horizontal ? clearInnerWFt : clearInnerHFt;
      if (pos <= EDGE_EPS || pos >= lim - EDGE_EPS) return "BOUNDARY";
      for (const o of segs) {
        if (o === s) continue;
        if (o.horizontal !== s.horizontal) {
          if (Math.abs(o.fixed - pos) <= TOUCH_EPS && s.fixed >= o.start - TOUCH_EPS && s.fixed <= o.end + TOUCH_EPS) return "PERP";
        }
      }
      for (const o of segs) {
        if (o === s || o.horizontal !== s.horizontal) continue;
        if (Math.abs(o.fixed - s.fixed) <= TOUCH_EPS && (Math.abs(o.start - pos) <= TOUCH_EPS || Math.abs(o.end - pos) <= TOUCH_EPS)) return "COLLINEAR";
      }
      return "FREE";
    };

    const getGlobalOpening = (room: any, opening: any, wall: string) => {
      const wallLen = wall === "TOP" || wall === "BOTTOM" ? room.w : room.h;
      const rs = resolveOpeningSpan(opening, wallLen);
      const start = rs.offsetFeet;
      const span = Math.max(0, rs.widthFeet);
      if (wall === "TOP" || wall === "BOTTOM") return { start: room.x + start, end: room.x + start + span };
      return { start: room.y + start, end: room.y + start + span };
    };

    const openingsForSeg = (seg: Seg) => {
      const result: [number, number][] = [];
      const add = (room: any, wall: string) => {
        if (!room) return;
        const all = [...(Array.isArray(room.doors) ? room.doors : []), ...(Array.isArray(room.windows) ? room.windows : [])];
        all.filter((o: any) => o.wall === wall).forEach((o: any) => {
          const g = getGlobalOpening(room, o, wall);
          const a = Math.max(seg.start, g.start);
          const b = Math.min(seg.end, g.end);
          if (b > a + 0.01) result.push([a, b]);
        });
      };
      const opposite: Record<string, string> = { TOP: "BOTTOM", BOTTOM: "TOP", LEFT: "RIGHT", RIGHT: "LEFT" };
      add(seg.room, seg.side);
      seg.others.forEach((o) => add(o, opposite[seg.side]));
      result.sort((a, b) => a[0] - b[0]);
      const merged: [number, number][] = [];
      for (const o of result) {
        const last = merged[merged.length - 1];
        if (last && o[0] <= last[1] + 0.02) last[1] = Math.max(last[1], o[1]);
        else merged.push([o[0], o[1]]);
      }
      return merged;
    };

    type Rect = { x: number; y: number; w: number; h: number };
    const rects: Rect[] = [];
    const extOf = (k: string) => (k === "PERP" ? halfWall : k === "BOUNDARY" ? LINE : k === "COLLINEAR" ? LINE / 2 : 0);

    segs.forEach((s) => {
      const extS = extOf(endKind(s, true));
      const extE = extOf(endKind(s, false));
      const openings = openingsForSeg(s);
      subtractIntervals(s.start, s.end, openings).forEach(([a, b]) => {
        const eA = Math.abs(a - s.start) < 0.02 ? extS : 0;
        const eB = Math.abs(b - s.end) < 0.02 ? extE : 0;
        if (s.horizontal) {
          const x0 = originX + a * scale - eA;
          const x1 = originX + b * scale + eB;
          rects.push({ x: x0, y: originY + s.fixed * scale - halfWall, w: x1 - x0, h: wallThick });
        } else {
          const y0 = originY + a * scale - eA;
          const y1 = originY + b * scale + eB;
          rects.push({ x: originX + s.fixed * scale - halfWall, y: y0, w: wallThick, h: y1 - y0 });
        }
      });
    });

    return {
      node: (
        <g id="architectural-4inch-partition-walls">
          <g fill="none" stroke={OUTLINE} strokeWidth={LINE * 2} strokeLinejoin="miter">
            {rects.map((r, i) => <rect key={`wo-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} />)}
          </g>
          <g fill={FILL} stroke="none">
            {rects.map((r, i) => <rect key={`wf-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} />)}
          </g>
        </g>
      ),
      audit: internalAudit,
      edgeCount: segs.length,
    };
  };

  const renderOpeningCuts = (rm: any, rx: number, ry: number, rw: number, rh: number) => {
    const openings = [...(Array.isArray(rm.doors) ? rm.doors : []), ...(Array.isArray(rm.windows) ? rm.windows : [])];
    const wallThick = (4 / 12) * scale;
    const cutDepth = Math.max(wallThick * 1.5, scale * 0.4);
    return (
      <g id="opening-cuts">
        {openings.map((o: any, index: number) => {
          const wallLenFt = (o.wall === "TOP" || o.wall === "BOTTOM") ? rw / scale : rh / scale;
          const rs = resolveOpeningSpan(o, wallLenFt);
          const inset = 0.35;
          const span = Math.max(0, rs.widthFeet * scale - 2 * inset);
          const off = Math.max(0, rs.offsetFeet * scale) + inset;
          if (o.wall === "TOP") return <rect key={`cut-t-${index}`} x={rx + off} y={ry - cutDepth / 2} width={span} height={cutDepth} fill="#020617" />;
          if (o.wall === "BOTTOM") return <rect key={`cut-b-${index}`} x={rx + off} y={ry + rh - cutDepth / 2} width={span} height={cutDepth} fill="#020617" />;
          if (o.wall === "LEFT") return <rect key={`cut-l-${index}`} x={rx - cutDepth / 2} y={ry + off} width={cutDepth} height={span} fill="#020617" />;
          return <rect key={`cut-r-${index}`} x={rx + rw - cutDepth / 2} y={ry + off} width={cutDepth} height={span} fill="#020617" />;
        })}
      </g>
    );
  };

  const renderExternalWallCuts = (
    roomList: any[], clearInnerWFt: number, clearInnerHFt: number,
    innerX: number, innerY: number, outerX: number, outerY: number,
    outerW: number, outerH: number, outerWallThicknessFt: number,
  ) => {
    void outerW; void outerH;
    const cuts: React.ReactElement[] = [];
    const bg = "#020617";
    const extend = Math.max(0.35, outerWallThicknessFt * scale + 1);
    const pushOpening = (room: any, o: any) => {
      const wall = String(o.wall || "").toUpperCase();
      const wallLenFt = (wall === "TOP" || wall === "BOTTOM") ? room.w : room.h;
      const rs = resolveOpeningSpan(o, wallLenFt);
      const spanFt = Math.max(0, rs.widthFeet);
      const offFt = Math.max(0, rs.offsetFeet);
      if (!spanFt) return;
      if (wall === "BOTTOM" && Math.abs(room.y + room.h - clearInnerHFt) <= 0.2) {
        cuts.push(<rect key={`ext-bottom-${room.id}-${o.id}`} x={innerX + (room.x + offFt) * scale} y={innerY + clearInnerHFt * scale - extend / 2} width={spanFt * scale} height={outerWallThicknessFt * scale + extend} fill={bg} />);
      } else if (wall === "TOP" && Math.abs(room.y) <= 0.2) {
        cuts.push(<rect key={`ext-top-${room.id}-${o.id}`} x={innerX + (room.x + offFt) * scale} y={outerY - extend / 2} width={spanFt * scale} height={outerWallThicknessFt * scale + extend} fill={bg} />);
      } else if (wall === "LEFT" && Math.abs(room.x) <= 0.2) {
        cuts.push(<rect key={`ext-left-${room.id}-${o.id}`} x={outerX - extend / 2} y={innerY + (room.y + offFt) * scale} width={outerWallThicknessFt * scale + extend} height={spanFt * scale} fill={bg} />);
      } else if (wall === "RIGHT" && Math.abs(room.x + room.w - clearInnerWFt) <= 0.2) {
        cuts.push(<rect key={`ext-right-${room.id}-${o.id}`} x={innerX + clearInnerWFt * scale - extend / 2} y={innerY + (room.y + offFt) * scale} width={outerWallThicknessFt * scale + extend} height={spanFt * scale} fill={bg} />);
      }
    };
    roomList.forEach((room: any) => {
      [...(Array.isArray(room.doors) ? room.doors : []), ...(Array.isArray(room.windows) ? room.windows : [])].forEach((o: any) => pushOpening(room, o));
    });
    return <g id="external-wall-opening-cuts">{cuts}</g>;
  };

  const getFitLabel = (name: string, rwFt: number) => {
    const text = getSmartLabel(name.toUpperCase(), rwFt);
    const maxChars = Math.max(5, Math.floor(rwFt * 2.2));
    if (text.length <= maxChars) return [text];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) line = next;
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    if (lines.length > 2) {
      lines[1] = `${lines.slice(1).join(" ").slice(0, Math.max(3, maxChars - 1))}…`;
      return lines.slice(0, 2);
    }
    return lines;
  };

  return (
    <g>
      {processedFloors.map((floorName, index) => {
        let shiftX = 0, shiftY = 0;

        if (processedFloors.length > 1) {
          const rowIndex = Math.floor(index / itemsPerRow);
          const colIndex = rowIndex % 2 === 0 ? (itemsPerRow - 1) - (index % itemsPerRow) : (index % itemsPerRow);
          shiftX = plotGap + (colIndex * (baseBuiltUpWidth + interFloorGap));
          shiftY = rowIndex * rowHeightGap;
        } else {
          shiftX = plotGap;
          shiftY = 0;
        }

        const currFloorPoints = getFloorPoints(floorName);
        const translatedPoints = currFloorPoints.map((p) => ({ x: p.x - shiftX, y: p.y - shiftY }));
        const p0 = translatedPoints[0], p1 = translatedPoints[1], p2 = translatedPoints[2], p3 = translatedPoints[3];

        const floorInfo: any = getFloorInfo(floorName);
        const isTowerFloor = floorName.toUpperCase().includes("TOWER") || floorName.toUpperCase().includes("MUMTY");

        const plotWidthForWallFt = Number(floorInfo?.width) || 10;
        void plotWidthForWallFt;

        const outerWallThicknessFt = 4 / 12;
        const outerWallPx = outerWallThicknessFt * scale;
        const i0 = { x: p0.x + outerWallPx, y: p0.y + outerWallPx };
        const i1 = { x: p1.x - outerWallPx, y: p1.y + outerWallPx };
        const i2 = { x: p2.x - outerWallPx, y: p2.y - outerWallPx };
        const i3 = { x: p3.x + outerWallPx, y: p3.y - outerWallPx };

        const plotWidthPx = Math.abs(p1.x - p0.x);
        const clearInnerW = Math.abs(i1.x - i0.x);
        const clearInnerH = Math.abs(i3.y - i0.y);

        const EXTERNAL_WALL_THICKNESS_FT = outerWallThicknessFt;

        const sbInfo = floorInfo?.setbacks || {};
        const sLeftInfo = Number(sbInfo.left) || 0;
        const sRightInfo = Number(sbInfo.right) || 0;
        const sFrontInfo = Number(sbInfo.front) || 0;
        const sRearInfo = Number(sbInfo.rear) || 0;

        const plotWInfo = Number(floorInfo?.width) || (clearInnerW / scale);
        const plotLInfo = Number(floorInfo?.length) || (clearInnerH / scale);

        const clearWidthFromParent = Number(floorInfo?.clearWidth);
        const clearLengthFromParent = Number(floorInfo?.clearLength);

        void sLeftInfo; void sRightInfo; void sFrontInfo; void sRearInfo;
        void plotWInfo; void plotLInfo;
        void EXTERNAL_WALL_THICKNESS_FT;

        const cadRenderWidthFt = clearWidthFromParent > 0
          ? clearWidthFromParent
          : (plotWInfo - (sLeftInfo + sRightInfo) - (EXTERNAL_WALL_THICKNESS_FT * 2));

        const cadRenderLengthFt = clearLengthFromParent > 0
          ? clearLengthFromParent
          : (plotLInfo - (sFrontInfo + sRearInfo) - (EXTERNAL_WALL_THICKNESS_FT * 2));

        const clearInnerWFt = Math.max(3.5, cadRenderWidthFt);
        const clearInnerHFt = Math.max(6, cadRenderLengthFt);

        const tCenterX = translatedPoints.reduce((sum, p) => sum + p.x, 0) / translatedPoints.length;
        const tCenterY = translatedPoints.reduce((sum, p) => sum + p.y, 0) / translatedPoints.length;
        const centerPt = { x: tCenterX, y: tCenterY };

        const bottomY = Math.max(...translatedPoints.map((p) => p.y));
        const labelY = bottomY + (12 * scale);

        const outerWallPath = `
          M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z 
          M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z
        `;

        const getFloorRoomsFor = (name: string) => {
          if (!floorRooms) return null;
          if (floorRooms[name]) return floorRooms[name];
          const cleanKey = name.trim().toLowerCase().replace(/\s+/g, '_');
          const foundKey = Object.keys(floorRooms).find(
            (k) => k.trim().toLowerCase() === name.trim().toLowerCase() ||
                   k.trim().toLowerCase().replace(/\s+/g, '_') === cleanKey
          );
          return foundKey ? floorRooms[foundKey] : null;
        };

        const dynamicFloorRooms = getFloorRoomsFor(floorName);
        const generatedFromFloorData = floorInfo?.rooms;

        const roomsFromDynamic = dynamicFloorRooms
          ? (Array.isArray(dynamicFloorRooms)
              ? dynamicFloorRooms
              : Object.values(dynamicFloorRooms))
          : [];

        const roomEntries = roomsFromDynamic.length > 0
          ? roomsFromDynamic
          : (Array.isArray(generatedFromFloorData) ? generatedFromFloorData : []);

        const rawRooms: FloorRoom[] = roomEntries.length > 0
          ? roomEntries.map((r: any) => ({
              ...r,
              name: r.name || r.label || r.roomType || "ROOM",
              x: Math.max(0, Number(r.x ?? 0)),
              y: Math.max(0, Number(r.y ?? 0)),
              w: Math.max(0.1, Math.min(Number(r.w ?? clearInnerWFt), clearInnerWFt)),
              h: Math.max(0.1, Math.min(Number(r.h ?? clearInnerHFt), clearInnerHFt)),
              type: r.type || r.roomType || "room",
            }))
          : [];

        const roomList = normalizeRoomList(rawRooms, clearInnerWFt, clearInnerHFt);

        const debugKey = `${floorName}-${roomList.length}-${roomList.map(r => r.name).join(',')}`;
        if (typeof console !== 'undefined' && !cadStairDebugCache.has(debugKey)) {
          cadStairDebugCache.add(debugKey);
          console.groupCollapsed(`[CAD ROOMS DEBUG] ${floorName}`);
          roomList.forEach((r: any) => {
            console.log(`  → ${r.name}`, {
              x: r.x, y: r.y, w: r.w, h: r.h,
              type: r.type,
              hasEmbeddedStair: !!r.embeddedStair,
              doors: r.doors?.length || 0,
            });
          });
          console.groupEnd();
        }

        const renderBoxesForValidation: RenderedRoomBox[] = roomList.map((r) => ({
          name: r.name || "ROOM",
          x: r.x || 0,
          y: r.y || 0,
          w: r.w || 0,
          h: r.h || 0,
          type: r.type || "room",
          doors: r.doors,
          windows: r.windows,
          subZoneOf: (r as any).subZoneOf,
          isSubRoom: (r as any).isSubRoom,
        }));

        let validationReport: { isValid: boolean; errors: string[]; warnings: string[] } = { isValid: true, errors: [], warnings: [] };

        if (typeof validateConstructionPlan === "function") {
          try {
            const plotAreaToValidate = baseArea || (clearInnerWFt * clearInnerHFt);
            const result = validateConstructionPlan(
              plotAreaToValidate, [floorName], floorData,
              floorRooms as unknown as Record<string, Record<string, FloorRoom>>,
              { [floorName]: renderBoxesForValidation },
              roadOrientation
            );

            if (result) {
              validationReport = {
                isValid: result.isValid ?? true,
                errors: (result.errors || []).map((e: any) => (typeof e === "string" ? e : e.message ?? String(e))),
                warnings: (result.warnings || []).map((w: any) => (typeof w === "string" ? w : w.message ?? String(w))),
              };
            }
          } catch (e) {
            console.warn("validationEngine execution fallback:", e);
          }
        }

        void cadValidationCache;
        void cadDiagnosticCache;

        const clipId = `floor-inner-clip-${index}`;

        return (
          <g key={index}>
            <defs>
              <clipPath id={clipId}>
                <rect x={i0.x} y={i0.y} width={clearInnerW} height={clearInnerH} />
              </clipPath>
            </defs>

            <path d={outerWallPath} fill="url(#wallHatch)" fillRule="evenodd" stroke="#ef4444" strokeWidth="0.8" strokeLinejoin="round" />
            <path d={`M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z`} fill="none" stroke="#ef4444" strokeWidth="0.5" />

            <g id="internal-room-planning" clipPath={`url(#${clipId})`}>
              <rect x={i0.x} y={i0.y} width={clearInnerW} height={clearInnerH} fill="#020617" stroke="#ef4444" strokeWidth="0.5" />

              {roomList.map((rm: any, rIdx: number) => {
                const rx = i0.x + (rm.x || 0) * scale;
                const ry = i0.y + (rm.y || 0) * scale;
                const rw = (rm.w || 0) * scale;
                const rh = (rm.h || 0) * scale;

                const isStaircase = rm.type === "stairs" || rm.name?.toUpperCase().includes("STAIR");
                const isDuct = rm.type === "duct" || rm.name?.toUpperCase().includes("DUCT") || rm.name?.toUpperCase().includes("OTS") || rm.name?.toUpperCase().includes("SHAFT");

                if (isStaircase) {
                  if (isTowerFloor) {
                    const stairType = (rm as any)?.staircaseType || (rm as any)?.staircaseSpec?.staircaseType || floorInfo?.staircaseConfig?.staircaseType || "2_QUARTER_LANDING";
                    const stairConfig = {
                      ...floorInfo?.staircaseConfig,
                      staircaseType: stairType,
                      staircaseSpec: { ...((rm as any)?.staircaseSpec || {}), staircaseType: stairType },
                    };
                    return (
                      <g key={`tower-stairs-${index}-${rIdx}`}>
                        {renderEngineStaircase(rx, ry, rw, rh, stairConfig)}
                      </g>
                    );
                  }
                  return null;
                }

                const isLivingRoom = rm.name?.toUpperCase().includes("LIVING");
                const embeddedStair = (rm as any)?.embeddedStair;

                let hasOverlap = false;
                for (const other of roomList) {
                  if (other === rm) continue;
                  const ox = i0.x + (other.x || 0) * scale;
                  const oy = i0.y + (other.y || 0) * scale;
                  const ow = (other.w || 0) * scale;
                  const oh = (other.h || 0) * scale;
                  if (rx < ox + ow && rx + rw > ox && ry < oy + oh && ry + rh > oy) { hasOverlap = true; break; }
                }

                const rectFill = isDuct ? "url(#wallHatch)" : String(rm.name || "").toUpperCase() === "PASSAGE" ? "none" : "#020617";
                void hasOverlap;
                const rectStroke = "none";
                const rectStrokeWidth = 0;

                return (
                  <g key={`room-${index}-${rIdx}`}>
                    <defs>
                      <clipPath id={`room-label-clip-${index}-${rIdx}`}>
                        <rect x={rx + 1} y={ry + 1} width={Math.max(1, rw - 2)} height={Math.max(1, rh - 2)} />
                      </clipPath>
                    </defs>

                    <rect x={rx} y={ry} width={rw} height={rh} fill={rectFill} stroke={rectStroke} strokeWidth={rectStrokeWidth} />

                    {isLivingRoom && embeddedStair && (embeddedStair.w || 0) > 0 && (embeddedStair.h || 0) > 0 && (
                      <g id="embedded-stair-in-living">
                        {(() => {
                          const esRelX = embeddedStair.relX !== undefined ? embeddedStair.relX : (embeddedStair.x || 0);
                          const esRelY = embeddedStair.relY !== undefined ? embeddedStair.relY : (embeddedStair.y || 0);
                          const esW = embeddedStair.w || 0;
                          const esH = embeddedStair.h || 0;
                          const esX = rx + esRelX * scale;
                          const esY = ry + esRelY * scale;
                          const esWpx = esW * scale;
                          const esHpx = esH * scale;
                          return renderEngineStaircase(
                            esX, esY, esWpx, esHpx,
                            {
                              staircaseType: embeddedStair.staircaseType,
                              staircaseSpec: embeddedStair.staircaseSpec,
                            }
                          );
                        })()}
                      </g>
                    )}

                    {String(rm.name || "").toUpperCase() === "PASSAGE" && (rm as any).pinkGuideLines ? (
                      <g id={`passage-guide-${index}-${rIdx}`} pointerEvents="none">
                        {rw <= rh ? (
                          <>
                            <line x1={rx + 0.6} y1={ry} x2={rx + 0.6} y2={ry + rh} stroke="#ec4899" strokeWidth="1.1" />
                            <line x1={rx + rw - 0.6} y1={ry} x2={rx + rw - 0.6} y2={ry + rh} stroke="#ec4899" strokeWidth="1.1" />
                          </>
                        ) : (
                          <>
                            <line x1={rx} y1={ry + 0.6} x2={rx + rw} y2={ry + 0.6} stroke="#ec4899" strokeWidth="1.1" />
                            <line x1={rx} y1={ry + rh - 0.6} x2={rx + rw} y2={ry + rh - 0.6} stroke="#ec4899" strokeWidth="1.1" />
                          </>
                        )}
                        <text x={rx + rw / 2} y={ry + rh / 2} fill="#ec4899" fontSize={Math.max(2, Math.min(3.2, Math.min(rw, rh) * 0.10))} textAnchor="middle" dominantBaseline="middle" fontWeight="700" transform={rw <= rh ? `rotate(-90 ${rx + rw / 2} ${ry + rh / 2})` : undefined}>PASSAGE {Number((rm as any).corridorWidthFt || Math.min(rm.w || 0, rm.h || 0) || 0).toFixed(2)}'</text>
                      </g>
                    ) : null}
                    {isDuct && (
                      <g id="duct-cross-lines">
                        <line x1={rx} y1={ry} x2={rx + rw} y2={ry + rh} stroke="#475569" strokeWidth="0.4" strokeDasharray="3,2" />
                        <line x1={rx + rw} y1={ry} x2={rx} y2={ry + rh} stroke="#475569" strokeWidth="0.4" strokeDasharray="3,2" />
                      </g>
                    )}

                    {!(String(rm.name || "").toUpperCase() === "PASSAGE" && (rm as any).pinkGuideLines) && (() => {
                      const selfBox: Box = { x: rx, y: ry, w: rw, h: rh };
                      const obstacles: Box[] = [];
                      const hit = (a: Box, b: Box) =>
                        Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
                        Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);

                      for (const other of roomList as any[]) {
                        if (other === rm) continue;
                        const on = String(other.name || "").toUpperCase();
                        if (on.includes("STAIR")) continue;
                        if ((rm as any).subZoneOf === other.id || (rm as any).attachedTo === other.id) continue;
                        const ob: Box = {
                          x: i0.x + (other.x || 0) * scale, y: i0.y + (other.y || 0) * scale,
                          w: (other.w || 0) * scale, h: (other.h || 0) * scale,
                        };
                        if (!hit(selfBox, ob)) continue;
                        const covers = ob.x <= rx + 0.1 && ob.y <= ry + 0.1 && ob.x + ob.w >= rx + rw - 0.1 && ob.y + ob.h >= ry + rh - 0.1;
                        if (covers && ob.w * ob.h > rw * rh + 1) continue;
                        obstacles.push(ob);
                      }

                      if (isLivingRoom && embeddedStair && (embeddedStair.w || 0) > 0 && (embeddedStair.h || 0) > 0) {
                        const esRelX = embeddedStair.relX !== undefined ? embeddedStair.relX : (embeddedStair.x || 0);
                        const esRelY = embeddedStair.relY !== undefined ? embeddedStair.relY : (embeddedStair.y || 0);
                        obstacles.push({
                          x: rx + esRelX * scale - 1, y: ry + esRelY * scale - 1,
                          w: (embeddedStair.w || 0) * scale + 2, h: (embeddedStair.h || 0) * scale + 2,
                        });
                      }

                      for (const other of roomList as any[]) {
                        const ob: Box = {
                          x: i0.x + (other.x || 0) * scale, y: i0.y + (other.y || 0) * scale,
                          w: (other.w || 0) * scale, h: (other.h || 0) * scale,
                        };
                        for (const d of (Array.isArray(other.doors) ? other.doors : [])) {
                          if ((d as any).renderSymbol === false) continue;
                          const sw = doorSwingBox(d as any, ob, scale);
                          if (hit(selfBox, sw)) obstacles.push(sw);
                        }
                      }

                      const fullName = String(rm.name || "ROOM").toUpperCase();
                      const shortName = getSmartLabel(fullName, 0);
                      const dimText = rw >= 4 && rh >= 4
                        ? `${formatDim(rw, scale, measurementUnit)} x ${formatDim(rh, scale, measurementUnit)}`
                        : undefined;

                      const lp = placeRoomLabel({
                        room: selfBox,
                        obstacles,
                        nameVariants: buildNameVariants(fullName, shortName),
                        dimText,
                        pad: Math.max(1.5, scale * 0.3),
                        maxFont: 3.8 * (scale / 5.5),
                        minFont: 1.8,
                        minDimFont: 1.4,
                      });

                      return (
                        <g clipPath={`url(#room-label-clip-${index}-${rIdx})`}>
                          <g transform={lp.rotate ? `rotate(${lp.rotate} ${lp.cx} ${lp.cy})` : undefined}>
                            {lp.lines.map((ln, lineIdx) => ln.kind === "name" ? (
                              <text key={`title-${lineIdx}`} x={ln.x} y={ln.y} fill={isDuct ? "#94a3b8" : "#ffffff"} fontSize={ln.fontSize} fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "1.0px" }}>
                                {ln.text}
                              </text>
                            ) : (
                              <text key={`dim-${lineIdx}`} x={ln.x} y={ln.y} fill="#38bdf8" fontSize={ln.fontSize} fontWeight="600" textAnchor="middle" dominantBaseline="central" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "0.8px" }}>
                                {ln.text}
                              </text>
                            ))}
                          </g>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </g>

            {(() => {
              const wallAudit = renderPartitionWalls(roomList, clearInnerWFt, clearInnerHFt, i0.x, i0.y);
              return (
                <>
                  {renderExternalWallCuts(roomList, clearInnerWFt, clearInnerHFt, i0.x, i0.y, p0.x, p0.y, plotWidthPx, Math.abs(p3.y - p0.y), outerWallThicknessFt)}
                  {wallAudit.node}
                  <g id={`cad-opening-symbols-${index}`}>
                    {roomList.map((rm: any, rIdx: number) => {
                      const rx = i0.x + (rm.x || 0) * scale;
                      const ry = i0.y + (rm.y || 0) * scale;
                      const rw = (rm.w || 0) * scale;
                      const rh = (rm.h || 0) * scale;
                      return (
                        <React.Fragment key={`openings-${index}-${rIdx}`}>
                          {renderOpeningCuts(rm, rx, ry, rw, rh)}
                          {rm.doors?.map((door: PlacedDoor, dIdx: number) => {
                            if ((door as any).renderSymbol === false) return null;

                            const doorIdStr = String((door as any).id || '');
                            const doorSharedIdStr = String((door as any).sharedOpeningId || '');
                            const isSharedDoor =
                              doorIdStr.startsWith('shared-') ||
                              doorSharedIdStr.startsWith('shared-') ||
                              doorIdStr === 'd-parking-main-gate' ||
                              doorIdStr.includes('living_entry') ||
                              doorIdStr.includes('ct_door') ||
                              doorIdStr.includes('master_door') ||
                              doorIdStr.includes('bed_door') ||
                              doorIdStr.includes('att_door');

                            const doorOffsetPx = (door.offsetFeet || 0) * scale;
                            const doorSpanPx = (door.widthFeet || 3) * scale;
                            const swingInside = Boolean((door as any).swingInside);
                            const doorSwingDepth = doorSpanPx * 0.7;

                            let doorBBoxX = rx, doorBBoxY = ry, doorBBoxW = 0, doorBBoxH = 0;

                            if (door.wall === 'TOP') {
                              doorBBoxX = rx + doorOffsetPx;
                              doorBBoxY = swingInside ? ry : (ry - doorSwingDepth);
                              doorBBoxW = doorSpanPx;
                              doorBBoxH = doorSwingDepth;
                            } else if (door.wall === 'BOTTOM') {
                              doorBBoxX = rx + doorOffsetPx;
                              doorBBoxY = swingInside ? (ry + rh - doorSwingDepth) : (ry + rh);
                              doorBBoxW = doorSpanPx;
                              doorBBoxH = doorSwingDepth;
                            } else if (door.wall === 'LEFT') {
                              doorBBoxX = swingInside ? rx : (rx - doorSwingDepth);
                              doorBBoxY = ry + doorOffsetPx;
                              doorBBoxW = doorSwingDepth;
                              doorBBoxH = doorSpanPx;
                            } else {
                              doorBBoxX = swingInside ? (rx + rw - doorSwingDepth) : (rx + rw);
                              doorBBoxY = ry + doorOffsetPx;
                              doorBBoxW = doorSwingDepth;
                              doorBBoxH = doorSpanPx;
                            }

                            if (isSharedDoor) {
                              return renderCadDoorSymbol(door, rx, ry, rw, rh, `door-${index}-${rIdx}-${dIdx}`);
                            }

                            let isBlocked = false;
                            for (const other of roomList) {
                              if (other === rm) continue;

                              const otherName = (other.name || '').toUpperCase();
                              if (otherName.includes('PASSAGE') || otherName.includes('CORRIDOR')) continue;
                              if (otherName.includes('STAIR') || otherName.includes('STAIRCASE')) continue;
                              if (otherName.includes('DUCT') || otherName.includes('OTS') || otherName.includes('SHAFT')) continue;
                              if (otherName.includes('BEDROOM')) continue;
                              if ((other as any).isSubRoom || (other as any).subZoneOf) continue;

                              const otherRx = i0.x + (other.x || 0) * scale;
                              const otherRy = i0.y + (other.y || 0) * scale;
                              const otherRw = (other.w || 0) * scale;
                              const otherRh = (other.h || 0) * scale;

                              const overlapX = Math.min(doorBBoxX + doorBBoxW, otherRx + otherRw) - Math.max(doorBBoxX, otherRx);
                              const overlapY = Math.min(doorBBoxY + doorBBoxH, otherRy + otherRh) - Math.max(doorBBoxY, otherRy);

                              const doorArea = doorBBoxW * doorBBoxH;
                              const overlapArea = Math.max(0, overlapX) * Math.max(0, overlapY);
                              const overlapRatio = doorArea > 0 ? overlapArea / doorArea : 0;

                              if (overlapRatio > 0.5) {
                                isBlocked = true;
                                break;
                              }
                            }

                            if (isBlocked) return null;

                            return renderCadDoorSymbol(door, rx, ry, rw, rh, `door-${index}-${rIdx}-${dIdx}`);
                          })}
                          {rm.windows?.map((win: PlacedWindow, wIdx: number) =>
                            renderCadWindowSymbol(win, rx, ry, rw, rh, `win-${index}-${rIdx}-${wIdx}`)
                          )}
                        </React.Fragment>
                      );
                    })}
                  </g>
                </>
              );
            })()}

            {renderSideDim(p0, p1, centerPt, scale, measurementUnit)}
            {renderSideDim(p3, p2, centerPt, scale, measurementUnit)}
            {renderSideDim(p1, p2, centerPt, scale, measurementUnit)}
            {renderSideDim(p0, p3, centerPt, scale, measurementUnit)}

            <text x={centerPt.x} y={labelY} textAnchor="middle" dominantBaseline="middle" fill="#000000" style={{ fontWeight: "900", fontSize: "8.5px", fontFamily: "sans-serif", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "3px" }}>
              {floorName}
            </text>

            {showValidationBanner && (
              <g id="engine-validation-badge" transform={`translate(${p0.x}, ${p0.y - (10 * scale)})`}>
                <rect x="0" y="0" width={plotWidthPx} height={6 * scale} fill={validationReport.isValid ? "#064e3b" : "#7f1d1d"} rx="2" />
                <text x={plotWidthPx / 2} y={3 * scale} fill="#ffffff" fontSize={2.8 * scale} fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                  {validationReport.isValid ? "✓ PLAN VALIDATED BY ENGINE" : `⚠ INVALID PLAN (${validationReport.errors.length} ERRORS)`}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}