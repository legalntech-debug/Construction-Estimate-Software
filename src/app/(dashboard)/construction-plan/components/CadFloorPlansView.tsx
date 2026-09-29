import React from "react";
import { formatDim, renderSideDim } from "./CadDimUtils";
import { FloorData, FloorRoom, PlacedDoor, PlacedWindow } from "../engine/planningTypes";
import { validateConstructionPlan, RenderedRoomBox } from "../engine/validationEngine";

// Prevent React re-renders from flooding the browser console.
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

  // Floor-to-floor height (ft) — planning settings se, warna 10'
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

  // ============================================================
  // ✅ STAIRCASE RENDERER
  // ============================================================
  const renderEngineStaircase = (
    x: number, y: number, w: number, h: number,
    stairConfig?: StaircaseConfig, isBottomZone: boolean = true
  ) => {
    const preCalcSpec = (stairConfig as any)?.staircaseSpec || {};

    const flight1Treads = Number(preCalcSpec?.flight1Treads || preCalcSpec?.flight1?.treads || 6);
    const flight2Treads = Number(preCalcSpec?.flight2Treads || preCalcSpec?.flight2?.treads || 6);
    const middleTreads = Number(preCalcSpec?.middleTreads || 3);
    const treadInches = Number(preCalcSpec?.treadInches || 11);
    const landing1LengthFt = Number(preCalcSpec?.landing1LengthFt || preCalcSpec?.landing1?.lengthFt || 3);

    const stairType = String(
      preCalcSpec?.staircaseType ||
      (stairConfig as any)?.staircaseType ||
      "2_QUARTER_LANDING"
    ).toUpperCase();

    if (typeof console !== 'undefined') {
      console.log('[RENDER STAIRCASE] CALLED', {
        x, y, w, h, stairType, flight1Treads, flight2Treads, middleTreads, treadInches, landing1LengthFt,
      });
    }

    const renderCShape = () => {
      // ------------------------------------------------------------
      // ✅ PROPER STAIR CALCULATION (floor height → risers → treads)
      //   riser  : max 7" (NBC/IS residential ≤ 7.5")
      //   tread  : min 10" (≥ 250 mm)
      //   risers : ceil(floorHeight / 7")   (spec.riserCount use hota hai agar valid ho)
      //   2 landings + 3 flights  →  going treads = risers − 3
      // ------------------------------------------------------------
      const floorHeightFt =
        Number(preCalcSpec?.floorToFloorHeightFeet || preCalcSpec?.floorHeightFt || preCalcSpec?.floorHeightFeet) ||
        stairFloorHeightFt || 10;
      const floorHeightIn = floorHeightFt * 12;
      const MAX_RISER_IN = 7;
      const MIN_TREAD_IN = 10;

      const specRisers = Number(preCalcSpec?.riserCount);
      const specRiserIn = specRisers > 0 ? floorHeightIn / specRisers : 0;
      const riserCount =
        specRisers > 0 && specRiserIn >= 5 && specRiserIn <= 7.5
          ? specRisers
          : Math.ceil(floorHeightIn / MAX_RISER_IN);
      const riserIn = floorHeightIn / riserCount;
      const minTreadIn = Math.max(MIN_TREAD_IN, Number(preCalcSpec?.treadInches) || MIN_TREAD_IN);
      const requiredTreads = Math.max(3, riserCount - 3);

      // Geometry (feet). Landing = going-width x going-width square.
      const boxWft = w / scale;
      const boxHft = h / scale;
      const G = Math.min(3.0, Math.max(2.5, Number(preCalcSpec?.landing1WidthFt) || 3.0), boxWft * 0.5);
      const flightLenFt = Math.max(0, boxWft - G);        // flight 1 & 2 (horizontal)
      const middleLenFt = Math.max(0, boxHft - 2 * G);    // middle flight (vertical)

      const flightCap = Math.floor((flightLenFt * 12) / minTreadIn);
      const middleCap = Math.floor((middleLenFt * 12) / minTreadIn);

      let f1 = Math.min(flightCap, Math.ceil(requiredTreads / 3));
      let f2 = Math.min(flightCap, Math.ceil((requiredTreads - f1) / 2));
      let m = Math.max(0, requiredTreads - f1 - f2);
      let shortBy = 0;
      if (m > middleCap) { shortBy = m - middleCap; m = middleCap; }
      const drawnTreads = f1 + m + f2;

      const col1W = G * scale;                 // landing column
      const col2W = Math.max(0, w - col1W);    // flight column
      const rowGH = G * scale;                 // landing row height
      const row2H = Math.max(0, h - 2 * rowGH);

      const row1Y = y;
      const row2Y = y + rowGH;
      const row3Y = y + rowGH + row2H;

      // Treads poore available length me barabar baante jaate hain
      const flight1TreadStep = col2W / Math.max(1, f1);
      const flight2TreadStep = col2W / Math.max(1, f2);
      const middleTreadStep = row2H / Math.max(1, m);

      const flightTreadIn = f1 > 0 ? (flightLenFt * 12) / f1 : 0;
      const middleTreadIn = m > 0 ? (middleLenFt * 12) / m : 0;
      const fs = Math.max(1.5, Math.min(2.4, scale * 0.4));

      if (typeof console !== 'undefined') {
        const key = `${riserCount}-${f1}-${m}-${f2}-${boxWft.toFixed(1)}-${boxHft.toFixed(1)}`;
        if (!cadStairDebugCache.has(key)) {
          cadStairDebugCache.add(key);
          console.log('[STAIR CALC]', {
            floorHeightFt, riserCount, riserIn: Number(riserIn.toFixed(2)), minTreadIn,
            requiredTreads, boxWft: Number(boxWft.toFixed(2)), boxHft: Number(boxHft.toFixed(2)),
            landingFt: G, flight1Treads: f1, middleTreads: m, flight2Treads: f2, shortBy,
          });
          if (shortBy > 0) {
            console.warn(`[STAIR CALC] Stair box chhota hai: ${shortBy} tread kam pad rahe hain (risers=${riserCount}, floor=${floorHeightFt}').`);
          }
        }
      }

      return (
        <g id="c-shape-stair">
          {/* ROW 1 — 1st landing + flight 1 (right → left) */}
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

          {/* ROW 2 — middle flight (top → bottom) + well */}
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

          {/* ROW 3 — 2nd landing + flight 2 (left → right) */}
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

  const renderCadDoorSymbol = (door: PlacedDoor, rx: number, ry: number, rw: number, rh: number, keyStr: string) => {
    const d = door as any;
    const dw = door.widthFeet * scale;
    const offset = door.offsetFeet * scale;
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
        dy = ry + rh;
        shutterPath = `M ${dx} ${dy} L ${dx} ${dy - hw} M ${dx + dw} ${dy} L ${dx + dw} ${dy - hw}`;
        arcPath = `M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 0 ${dx} ${dy - hw} M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 1 ${dx + dw} ${dy - hw}`;
      } else if (door.wall === "TOP") {
        dx = rx + offset;
        dy = ry;
        shutterPath = `M ${dx} ${dy} L ${dx} ${dy + hw} M ${dx + dw} ${dy} L ${dx + dw} ${dy + hw}`;
        arcPath = `M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 1 ${dx} ${dy + hw} M ${dx + hw} ${dy} A ${hw} ${hw} 0 0 0 ${dx + dw} ${dy + hw}`;
      } else if (door.wall === "LEFT") {
        dx = rx;
        dy = ry + offset;
        shutterPath = `M ${dx} ${dy} L ${dx + hw} ${dy} M ${dx} ${dy + dw} L ${dx + hw} ${dy + dw}`;
        arcPath = `M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 0 ${dx + hw} ${dy} M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 1 ${dx + hw} ${dy + dw}`;
      } else {
        dx = rx + rw;
        dy = ry + offset;
        shutterPath = `M ${dx} ${dy} L ${dx - hw} ${dy} M ${dx} ${dy + dw} L ${dx - hw} ${dy + dw}`;
        arcPath = `M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 1 ${dx - hw} ${dy} M ${dx} ${dy + hw} A ${hw} ${hw} 0 0 0 ${dx - hw} ${dy + dw}`;
      }
    } else {
      // hingeSide === 'END' → hinge opening ke doosre end par (mirror). Default: start.
      const hingeEnd = String(d.hingeSide || "").toUpperCase() === "END";

      if (door.wall === "BOTTOM") {
        dx = rx + offset;
        dy = ry + rh;
        if (hingeEnd) {
          // hinge right jamb, leaf upar (room ke andar)
          shutterPath = `M ${dx + dw} ${dy} L ${dx + dw} ${dy - dw}`;
          arcPath = `M ${dx} ${dy} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy - dw}`;
        } else {
          shutterPath = `M ${dx} ${dy} L ${dx} ${dy - dw}`;
          arcPath = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 0 ${dx} ${dy - dw}`;
        }
      } else if (door.wall === "TOP") {
        dx = rx + offset;
        dy = ry;
        if (hingeEnd) {
          shutterPath = `M ${dx + dw} ${dy} L ${dx + dw} ${dy + dw}`;
          arcPath = `M ${dx} ${dy} A ${dw} ${dw} 0 0 0 ${dx + dw} ${dy + dw}`;
        } else {
          shutterPath = `M ${dx} ${dy} L ${dx} ${dy + dw}`;
          arcPath = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 1 ${dx} ${dy + dw}`;
        }
      } else if (door.wall === "LEFT") {
        dx = rx;
        dy = ry + offset;
        if (swingInside) {
          if (hingeEnd) {
            // hinge neeche wale jamb par, leaf room ke andar
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
        dx = rx + rw;
        dy = ry + offset;
        if (swingInside) {
          if (hingeEnd) {
            // hinge neeche wale jamb par, leaf room ke andar (neeche wali wall ke saath)
            shutterPath = `M ${dx} ${dy + dw} L ${dx - dw} ${dy + dw}`;
            arcPath = `M ${dx} ${dy} A ${dw} ${dw} 0 0 0 ${dx - dw} ${dy + dw}`;
          } else {
            shutterPath = `M ${dx} ${dy} L ${dx - dw} ${dy}`;
            // ✅ sweep 1: arc ka center hinge par rahe (pehle 0 tha → arc galat side bulge karta tha)
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
    } else {
      return (
        <g key={keyStr} id="cad-window-symbol">
          <rect x={wx} y={wy} width={wallThick} height={ww} fill="#020617" stroke="#ffffff" strokeWidth="0.4" />
          <line x1={wx + wallThick * 0.3} y1={wy} x2={wx + wallThick * 0.3} y2={wy + ww} stroke="#38bdf8" strokeWidth="0.6" />
          <line x1={wx + wallThick * 0.7} y1={wy} x2={wx + wallThick * 0.7} y2={wy + ww} stroke="#38bdf8" strokeWidth="0.6" />
        </g>
      );
    }
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

    type Edge = {
      key: string; side: "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
      x: number; y: number; len: number; horizontal: boolean;
      room: any; other?: any;
    };

    const isOpenArea = (r: any) => {
      const n = String(r?.name || "").toUpperCase();
      return Boolean(r?.isOpen) || n.includes("OPEN TERRACE") || n === "PASSAGE";
    };

    const findShared = (room: any, side: Edge["side"]) => {
      return roomList.find((other: any) => {
        if (other === room) return false;
        if (side === "TOP") return Math.abs((other.y + other.h) - room.y) <= TOUCH_EPS && Math.min(room.x + room.w, other.x + other.w) - Math.max(room.x, other.x) > 0.12;
        if (side === "BOTTOM") return Math.abs((room.y + room.h) - other.y) <= TOUCH_EPS && Math.min(room.x + room.w, other.x + other.w) - Math.max(room.x, other.x) > 0.12;
        if (side === "LEFT") return Math.abs((other.x + other.w) - room.x) <= TOUCH_EPS && Math.min(room.y + room.h, other.y + other.h) - Math.max(room.y, other.y) > 0.12;
        return Math.abs((room.x + room.w) - other.x) <= TOUCH_EPS && Math.min(room.y + room.h, other.y + other.h) - Math.max(room.y, other.y) > 0.12;
      });
    };

    const seenShared = new Set<string>();
    const edges: Edge[] = [];
    const internalAudit: any[] = [];
    let edgeUid = 0;

    for (const room of roomList) {
      const candidateSides: Edge["side"][] = ["TOP", "BOTTOM", "LEFT", "RIGHT"];
      for (const side of candidateSides) {
        const isExterior =
          (side === "TOP" && Math.abs(room.y) <= EDGE_EPS) ||
          (side === "BOTTOM" && Math.abs(room.y + room.h - clearInnerHFt) <= EDGE_EPS) ||
          (side === "LEFT" && Math.abs(room.x) <= EDGE_EPS) ||
          (side === "RIGHT" && Math.abs(room.x + room.w - clearInnerWFt) <= EDGE_EPS);
        if (isExterior) continue;

        const other = findShared(room, side);
        if (other && isOpenArea(room) && isOpenArea(other)) continue;

        let edgeX = room.x, edgeY = room.y;
        let edgeLen = side === "TOP" || side === "BOTTOM" ? room.w : room.h;

        if (other) {
          if (side === "TOP" || side === "BOTTOM") {
            edgeX = Math.max(room.x, other.x);
            const endX = Math.min(room.x + room.w, other.x + other.w);
            edgeLen = Math.max(0, endX - edgeX);
            edgeY = side === "TOP" ? room.y : room.y + room.h;
          } else {
            edgeY = Math.max(room.y, other.y);
            const endY = Math.min(room.y + room.h, other.y + other.h);
            edgeLen = Math.max(0, endY - edgeY);
            edgeX = side === "LEFT" ? room.x : room.x + room.w;
          }
        } else {
          if (side === "BOTTOM") edgeY = room.y + room.h;
          if (side === "RIGHT") edgeX = room.x + room.w;
        }

        if (edgeLen < 0.1) continue;

        const sharedKey = other
          ? [String(room.id ?? roomList.indexOf(room)), String(other.id ?? roomList.indexOf(other))].sort().join("|") + `|${side === "TOP" || side === "BOTTOM" ? "H" : "V"}|${side === "TOP" || side === "BOTTOM" ? edgeY : edgeX}`
          : `FREE|${room.name}|${side}|${edgeX}|${edgeY}`;
        if (seenShared.has(sharedKey)) continue;
        seenShared.add(sharedKey);

        const horizontal = side === "TOP" || side === "BOTTOM";
        edges.push({ key: `${side}:${edgeX.toFixed(2)}:${edgeY.toFixed(2)}:${edgeLen.toFixed(2)}:#${edgeUid++}`, side, x: edgeX, y: edgeY, len: edgeLen, horizontal, room, other });
        internalAudit.push({ room: room.name, other: other?.name || "OPEN / UNASSIGNED", side, length: Number(edgeLen.toFixed(2)), openingCount: 0 });
      }
    }

    const getTrimmedSpan = (edge: Edge) => {
      let start = edge.horizontal ? edge.x : edge.y;
      let end = start + edge.len;
      const fixedCoord = edge.horizontal ? edge.y : edge.x;
      let startConnected = false, endConnected = false;

      if (edge.horizontal) {
        if (Math.abs(start) <= EDGE_EPS) startConnected = true;
        if (Math.abs(end - clearInnerWFt) <= EDGE_EPS) endConnected = true;
      } else {
        if (Math.abs(start) <= EDGE_EPS) startConnected = true;
        if (Math.abs(end - clearInnerHFt) <= EDGE_EPS) endConnected = true;
      }

      edges.forEach((o) => {
        if (o === edge || o.horizontal === edge.horizontal) return;
        const oFixed = o.horizontal ? o.y : o.x;
        const oStart = o.horizontal ? o.x : o.y;
        const oEnd = oStart + o.len;
        if (oFixed <= fixedCoord + TOUCH_EPS && oFixed >= fixedCoord - TOUCH_EPS) {
          if (oStart <= start + TOUCH_EPS && oEnd >= start - TOUCH_EPS) { if (Math.abs(oStart - start) <= TOUCH_EPS) startConnected = true; }
          if (oStart <= end + TOUCH_EPS && oEnd >= end - TOUCH_EPS) { if (Math.abs(oEnd - end) <= TOUCH_EPS) endConnected = true; }
        }
      });

      return { start, end, len: Math.max(0, end - start), startConnected, endConnected };
    };

    const getGlobalOpening = (room: any, opening: any, wall: string) => {
      const start = Number(opening?.offsetFeet || 0);
      const span = Math.max(0, Number(opening?.widthFeet ?? opening?.lengthFeet ?? 0));
      if (wall === "TOP" || wall === "BOTTOM") return { start: room.x + start, end: room.x + start + span };
      return { start: room.y + start, end: room.y + start + span };
    };

    const openingsForEdge = (edge: Edge, trimmedStart: number, trimmedEnd: number) => {
      const result: { start: number; end: number; source: string }[] = [];
      const add = (room: any, wall: string) => {
        if (!room) return;
        const all = [...(Array.isArray(room.doors) ? room.doors : []), ...(Array.isArray(room.windows) ? room.windows : [])];
        all.filter((o: any) => o.wall === wall).forEach((o: any) => {
          const g = getGlobalOpening(room, o, wall);
          const a = Math.max(trimmedStart, g.start);
          const b = Math.min(trimmedEnd, g.end);
          if (b > a + 0.01) result.push({ start: a, end: b, source: o.id || "opening" });
        });
      };
      add(edge.room, edge.side);
      if (edge.other) {
        const opposite: Record<string, string> = { TOP: "BOTTOM", BOTTOM: "TOP", LEFT: "RIGHT", RIGHT: "LEFT" };
        add(edge.other, opposite[edge.side]);
      }
      result.sort((a, b) => a.start - b.start);
      const merged: { start: number; end: number; source: string }[] = [];
      for (const o of result) {
        const last = merged[merged.length - 1];
        if (last && o.start <= last.end + 0.02) last.end = Math.max(last.end, o.end);
        else merged.push({ ...o });
      }
      return merged;
    };

    const pieces: React.ReactElement[] = [];
    let pieceUid = 0;

    const drawHorizontal = (edge: Edge) => {
      const trimmed = getTrimmedSpan(edge);
      if (trimmed.len <= 0.05) return;
      const openings = openingsForEdge(edge, trimmed.start, trimmed.end);
      const startX = trimmed.start, endX = trimmed.end;
      const y1 = originY + edge.y * scale - halfWall;
      const y2 = originY + edge.y * scale + halfWall;

      if (!trimmed.startConnected) pieces.push(<line key={`cap-h-start-${edge.key}-${pieceUid++}`} x1={originX + startX * scale} y1={y1} x2={originX + startX * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />);

      let cursor = startX;
      openings.forEach((o, idx) => {
        const a = Math.max(startX, o.start), b = Math.min(endX, o.end);
        if (a > cursor + 0.02) pieces.push(<React.Fragment key={`ph-${edge.key}-${idx}-${pieceUid++}`}><line x1={originX + cursor * scale} y1={y1} x2={originX + a * scale} y2={y1} stroke="#ef4444" strokeWidth="0.32" /><line x1={originX + cursor * scale} y1={y2} x2={originX + a * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" /></React.Fragment>);
        pieces.push(<React.Fragment key={`jamb-h-${edge.key}-${idx}-${pieceUid++}`}><line x1={originX + a * scale} y1={y1} x2={originX + a * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" /><line x1={originX + b * scale} y1={y1} x2={originX + b * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" /></React.Fragment>);
        cursor = Math.max(cursor, b);
      });

      if (cursor < endX - 0.02) pieces.push(<React.Fragment key={`phe-${edge.key}-${pieceUid++}`}><line x1={originX + cursor * scale} y1={y1} x2={originX + endX * scale} y2={y1} stroke="#ef4444" strokeWidth="0.32" /><line x1={originX + cursor * scale} y1={y2} x2={originX + endX * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" /></React.Fragment>);
      if (!trimmed.endConnected) pieces.push(<line key={`cap-h-end-${edge.key}-${pieceUid++}`} x1={originX + endX * scale} y1={y1} x2={originX + endX * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />);
    };

    const drawVertical = (edge: Edge) => {
      const trimmed = getTrimmedSpan(edge);
      if (trimmed.len <= 0.05) return;
      const openings = openingsForEdge(edge, trimmed.start, trimmed.end);
      const startY = trimmed.start, endY = trimmed.end;
      const x1 = originX + edge.x * scale - halfWall;
      const x2 = originX + edge.x * scale + halfWall;

      if (!trimmed.startConnected) pieces.push(<line key={`cap-v-start-${edge.key}-${pieceUid++}`} x1={x1} y1={originY + startY * scale} x2={x2} y2={originY + startY * scale} stroke="#ef4444" strokeWidth="0.32" />);

      let cursor = startY;
      openings.forEach((o, idx) => {
        const a = Math.max(startY, o.start), b = Math.min(endY, o.end);
        if (a > cursor + 0.02) pieces.push(<React.Fragment key={`pv-${edge.key}-${idx}-${pieceUid++}`}><line x1={x1} y1={originY + cursor * scale} x2={x1} y2={originY + a * scale} stroke="#ef4444" strokeWidth="0.32" /><line x1={x2} y1={originY + cursor * scale} x2={x2} y2={originY + a * scale} stroke="#ef4444" strokeWidth="0.32" /></React.Fragment>);
        pieces.push(<React.Fragment key={`jamb-v-${edge.key}-${idx}-${pieceUid++}`}><line x1={x1} y1={originY + a * scale} x2={x2} y2={originY + a * scale} stroke="#ef4444" strokeWidth="0.32" /><line x1={x1} y1={originY + b * scale} x2={x2} y2={originY + b * scale} stroke="#ef4444" strokeWidth="0.32" /></React.Fragment>);
        cursor = Math.max(cursor, b);
      });

      if (cursor < endY - 0.02) pieces.push(<React.Fragment key={`pve-${edge.key}-${pieceUid++}`}><line x1={x1} y1={originY + cursor * scale} x2={x1} y2={originY + endY * scale} stroke="#ef4444" strokeWidth="0.32" /><line x1={x2} y1={originY + cursor * scale} x2={x2} y2={originY + endY * scale} stroke="#ef4444" strokeWidth="0.32" /></React.Fragment>);
      if (!trimmed.endConnected) pieces.push(<line key={`cap-v-end-${edge.key}-${pieceUid++}`} x1={x1} y1={originY + endY * scale} x2={x2} y2={originY + endY * scale} stroke="#ef4444" strokeWidth="0.32" />);
    };

    edges.forEach((edge) => { if (edge.horizontal) drawHorizontal(edge); else drawVertical(edge); });

    return { node: <g id="architectural-4inch-partition-walls">{pieces}</g>, audit: internalAudit, edgeCount: edges.length };
  };

  const renderOpeningCuts = (rm: any, rx: number, ry: number, rw: number, rh: number) => {
    const openings = [...(Array.isArray(rm.doors) ? rm.doors : []), ...(Array.isArray(rm.windows) ? rm.windows : [])];
    const wallThick = (4 / 12) * scale;
    const cutDepth = Math.max(wallThick * 1.5, scale * 0.4);
    return (
      <g id="opening-cuts">
        {openings.map((o: any, index: number) => {
          const span = Math.max(0, Number(o.widthFeet ?? o.lengthFeet ?? 0)) * scale;
          const off = Math.max(0, Number(o.offsetFeet || 0)) * scale;
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
    const cuts: React.ReactElement[] = [];
    const bg = "#020617";
    const extend = Math.max(0.35, outerWallThicknessFt * scale + 1);
    const pushOpening = (room: any, o: any) => {
      const wall = String(o.wall || "").toUpperCase();
      const spanFt = Math.max(0, Number(o.widthFeet ?? o.lengthFeet ?? 0));
      const offFt = Math.max(0, Number(o.offsetFeet || 0));
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
    let text = getSmartLabel(name.toUpperCase(), rwFt);
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

        // ====================================================================
        // ✅ DYNAMIC WALL THICKNESS — Plot width ≤ 15 ft → 4", > 15 ft → 8"
        // ====================================================================
        const plotWidthForWallFt = Number(floorInfo?.width) || 10;
        const WALL_THICKNESS_SMALL_FT = 4 / 12;  // 0.333 ft
        const WALL_THICKNESS_LARGE_FT = 8 / 12;  // 0.667 ft
        const WALL_THICKNESS_BREAKPOINT_FT = 15;

        const dynamicWallThicknessFt = plotWidthForWallFt > WALL_THICKNESS_BREAKPOINT_FT
          ? WALL_THICKNESS_LARGE_FT
          : WALL_THICKNESS_SMALL_FT;

        const outerWallThicknessFt = floorInfo?.outerWallThickness || dynamicWallThicknessFt;
        const outerWallPx = outerWallThicknessFt * scale;

        const i0 = { x: p0.x + outerWallPx, y: p0.y + outerWallPx };
        const i1 = { x: p1.x - outerWallPx, y: p1.y + outerWallPx };
        const i2 = { x: p2.x - outerWallPx, y: p2.y - outerWallPx };
        const i3 = { x: p3.x + outerWallPx, y: p3.y - outerWallPx };

        const plotWidthPx = Math.abs(p1.x - p0.x);
        const clearInnerW = Math.abs(i1.x - i0.x);
        const clearInnerH = Math.abs(i3.y - i0.y);

        // ✅ Same dynamic wall thickness — carpet area nikalne ke liye
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

        // ✅ Carpet area (rooms already isme fit hain)
        const cadRenderWidthFt = clearWidthFromParent > 0
          ? clearWidthFromParent
          : (plotWInfo - (sLeftInfo + sRightInfo) - (EXTERNAL_WALL_THICKNESS_FT * 2));

        const cadRenderLengthFt = clearLengthFromParent > 0
          ? clearLengthFromParent
          : (plotLInfo - (sFrontInfo + sRearInfo) - (EXTERNAL_WALL_THICKNESS_FT * 2));

        const clearInnerWFt = Math.max(3.5, cadRenderWidthFt);
        const clearInnerHFt = Math.max(6, cadRenderLengthFt);

        console.log(`[CAD WALL THICKNESS] ${floorName} →`, {
          plotWidth: plotWidthForWallFt,
          wallThicknessInches: (outerWallThicknessFt * 12).toFixed(0) + '"',
          rule: plotWidthForWallFt > 15 ? '8" (width > 15 ft)' : '4" (width ≤ 15 ft)',
        });

        console.log(`[CAD CARPET AREA] ${floorName} →`, {
          plotW: plotWInfo, plotL: plotLInfo,
          setbacks: { sLeftInfo, sRightInfo, sFrontInfo, sRearInfo },
          wallDeduction: { W: EXTERNAL_WALL_THICKNESS_FT * 2, L: EXTERNAL_WALL_THICKNESS_FT * 2 },
          clearWidthFromParent, clearLengthFromParent,
          finalCarpetW: clearInnerWFt, finalCarpetH: clearInnerHFt,
        });

        const tCenterX = translatedPoints.reduce((sum, p) => sum + p.x, 0) / translatedPoints.length;
        const tCenterY = translatedPoints.reduce((sum, p) => sum + p.y, 0) / translatedPoints.length;
        const centerPt = { x: tCenterX, y: tCenterY };

        const bottomY = Math.max(...translatedPoints.map((p) => p.y));
        const labelY = bottomY + (12 * scale);

        const outerWallPath = `
          M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z 
          M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z
        `;

        const dynamicFloorRooms = floorRooms[floorName];
        const generatedFromFloorData = floorInfo?.rooms;
        const roomEntries = Array.isArray(generatedFromFloorData)
          ? generatedFromFloorData
          : Array.isArray(dynamicFloorRooms)
            ? dynamicFloorRooms
            : dynamicFloorRooms
              ? Object.values(dynamicFloorRooms)
              : [];

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

        const roomList = rawRooms;

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
                const isBottomZone = ((rm.y || 0) + (rm.h || 0)) >= clearInnerHFt * 0.65;

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
                        {renderEngineStaircase(rx, ry, rw, rh, stairConfig, isBottomZone)}
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
                const rectStroke = hasOverlap ? "#ff0000" : "none";
                const rectStrokeWidth = hasOverlap ? 2 : 0;

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
                            },
                            isBottomZone
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

                    {!(String(rm.name || "").toUpperCase() === "PASSAGE" && (rm as any).pinkGuideLines) && (
                    <g clipPath={`url(#room-label-clip-${index}-${rIdx})`}>
                      {getFitLabel(rm.name || "ROOM", rm.w || 0).map((line, lineIdx) => {
                        const safeFontSize = Math.max(1.8, Math.min(rw * 0.18, rh * 0.22, 3.8 * (scale / 5.5)));
                        const lineCount = getFitLabel(rm.name || "ROOM", rm.w || 0).length;
                        const yOffset = lineCount > 1 ? 0.32 + lineIdx * 0.16 : 0.4;
                        return (
                          <text key={`title-${lineIdx}`} x={rx + rw / 2} y={ry + rh * yOffset} fill={isDuct ? "#94a3b8" : "#ffffff"} fontSize={safeFontSize} fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "1.0px" }}>
                            {line}
                          </text>
                        );
                      })}

                      {(() => {
                        const dimText = `${formatDim(rw, scale, measurementUnit)} x ${formatDim(rh, scale, measurementUnit)}`;
                        const lineCount = getFitLabel(rm.name || "ROOM", rm.w || 0).length;
                        const yPos = lineCount > 1 ? 0.76 : 0.68;
                        const safeDimFontSize = Math.max(1.4, Math.min(rw * 0.14, rh * 0.16, 3.0 * (scale / 5.5)));
                        if (rw < 4 || rh < 4) return null;
                        return (
                          <text x={rx + rw / 2} y={ry + rh * yPos} fill="#38bdf8" fontSize={safeDimFontSize} fontWeight="600" textAnchor="middle" dominantBaseline="central" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "0.8px" }}>
                            {dimText}
                          </text>
                        );
                      })()}
                    </g>
                    )}
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
  console.log('[DOOR DATA]', {
    room: rm.name,
    doorId: (door as any).id,
    wall: door.wall,
    offsetFeet: door.offsetFeet,
    widthFeet: door.widthFeet,
    renderSymbol: (door as any).renderSymbol,
    sharedOpeningId: (door as any).sharedOpeningId,
  });

  if ((door as any).renderSymbol === false) {
    console.log('[DOOR SKIP] renderSymbol false:', (door as any).id);
    return null;
  }
                            if ((door as any).renderSymbol === false) return null;

                            // ============================================================
                            // ✅ FIX #1: SHARED DOORS kabhi block nahi honge
                            // ============================================================
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

                            // ✅ Shared doors NEVER blocked
                            if (isSharedDoor) {
                              return renderCadDoorSymbol(door, rx, ry, rw, rh, `door-${index}-${rIdx}-${dIdx}`);
                            }

                            let isBlocked = false;
                            let blockedByRoom: string | null = null;
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
                                blockedByRoom = other.name;
                                break;
                              }
                            }

                            console.log('[DOOR CHECK]', {
                              room: rm.name,
                              doorId: (door as any).id,
                              wall: door.wall,
                              isSharedDoor,
                              isBlocked,
                              blockedByRoom,
                            });

                            if (isBlocked) {
                              return null;
                            }

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

            <g id="engine-validation-badge" transform={`translate(${p0.x}, ${p0.y - (10 * scale)})`}>
              <rect x="0" y="0" width={plotWidthPx} height={6 * scale} fill={validationReport.isValid ? "#064e3b" : "#7f1d1d"} rx="2" />
              <text x={plotWidthPx / 2} y={3 * scale} fill="#ffffff" fontSize={2.8 * scale} fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                {validationReport.isValid ? "✓ PLAN VALIDATED BY ENGINE" : `⚠ INVALID PLAN (${validationReport.errors.length} ERRORS)`}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}