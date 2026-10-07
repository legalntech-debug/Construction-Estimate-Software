import React, { useState } from "react";
import { formatDim, renderSideDim } from "./CadDimUtils";
import { placeRoomLabel, buildNameVariants, doorSwingBox, Box } from "../engine/labelPlacer";
import { FloorData, FloorRoom, PlacedDoor, PlacedWindow } from "../engine/planningTypes";
import { validateConstructionPlan, RenderedRoomBox } from "../engine/validationEngine";
import { normalizeRoomList } from "../engine/normalizeRooms";
import { decideStairFace } from "../engine/stairFaceDecision";
import CadSectionCutMarker from "./CadSectionCutMarker";
import type { SectionCutDef } from "../engine/sectionEngine";
import { calculateStaircase, solveStairDrawPlan, StaircaseFootprint, StairDrawPlan } from "../engine/stairPlanner";

// 🎨 LIGHT THEME COLORS
const BG_FILL = "#ffffff";          // SVG background (was #020617 / #0f172a)
const LINE_PRIMARY = "#000000";     // Primary line color (was #ef4444, #38bdf8)
const LINE_SECONDARY = "#333333";   // Secondary lines (was #475569, #666666)
const TEXT_PRIMARY = "#000000";     // Room name text (was #ffffff)
const TEXT_DIM = "#1e40af";         // Dimension text (was #38bdf8)
const DOOR_COLOR = "#000000";       // Door symbols (was #eab308)
const WARN_COLOR = "#dc2626";       // Warning text (was #f87171)
const DUCT_TEXT = "#666666";        // Duct text (was #94a3b8)
const PASSAGE_COLOR = "#000000";    // Passage guide lines (was #ec4899)

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
  sectionMarkers?: { cut: SectionCutDef; posOuterFt: number }[];
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
  sectionMarkers = [],
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

  // ✅ STAIR RENDERER (ground / upper / tower sab ke liye ek hi path)
  // Planner frame (stairPlanner.StairDrawPlan): x = cross axis, y = run axis, entry NEECHE (y = run), far end upar (y = 0).
  //   far end par Landing-1 (x = 0) aur Landing-2 (x = cross - fw), dono ke beech MIDDLE treads (x axis par).
  //   Flight-1 x = 0 par (entry wali), Flight-2 x = cross - fw par.
  // Rect ke hisaab se frame ko rotate kiya jaata hai (entryFace BOTTOM / TOP / LEFT / RIGHT):
  //   BOTTOM / TOP  -> rect w = cross, h = run   (portrait)
  //   LEFT / RIGHT  -> rect w = run,   h = cross (rotated)
  // "SHORT n TREAD" sirf plan.shortTreads se dikhta hai (renderer apna kuch calculate nahi karta).
  const renderEngineStaircase = (
    x: number, y: number, w: number, h: number,
    stairConfig?: StaircaseConfig
  ) => {
    const cfg: any = stairConfig || {};
    const given: any = cfg.staircaseSpec || {};
    const wFt = w / scale;
    const hFt = h / scale;

    const floorHeightFt =
      Number(given?.floorToFloorHeight || given?.floorToFloorHeightFeet || given?.floorHeightFt || given?.floorHeightFeet) ||
      stairFloorHeightFt || 10;

    const usableSpec = Number(given?.riserCount) > 0 && Number(given?.flightWidthFt) > 0 && given?.flight1 && given?.flight2;
    const prePlan: StairDrawPlan | undefined = given?.drawPlan ?? cfg?.renderHints?.drawPlan;

    // ---- orientation: pehle planner ka entryFace / rotated, phir rect ke dimensions se confirm ----
    const faceIn = String(cfg.entryFace || given?.entryFace || "").toUpperCase();
    const wantRotated: boolean =
      typeof cfg.rotated === "boolean" ? cfg.rotated
      : (faceIn === "LEFT" || faceIn === "RIGHT");

    const fitsRect = (p: StairDrawPlan | undefined, rotated: boolean) => {
      if (!p || p.shortTreads !== 0) return false;
      const crossBox = rotated ? hFt : wFt;
      const runBox = rotated ? wFt : hFt;
      return p.usedCrossFt <= crossBox + 0.05 && p.usedRunFt <= runBox + 0.05;
    };

    let rotated = wantRotated;
    let plan: StairDrawPlan | undefined;
    const lockFace = !!cfg.lockFace;   // building-level U/C decision aayi hai -> orientation badalni nahi
    if (fitsRect(prePlan, wantRotated)) {
      plan = prePlan;
    } else if (!lockFace && fitsRect(prePlan, !wantRotated)) {
      // planner ka flag rect se match nahi karta -> rect ke dimensions ko sach maano
      rotated = !wantRotated;
      plan = prePlan;
    } else {
      // Planner ka plan is rect me nahi baitha (e.g. user ne box badla / tower) -> usi orientation me dobara solve
      const crossBox = rotated ? hFt : wFt;
      const runBox = rotated ? wFt : hFt;
      const base: StaircaseFootprint = usableSpec
        ? (given as StaircaseFootprint)
        : calculateStaircase(floorHeightFt, crossBox, runBox, "DOG_LEGGED");
      plan = solveStairDrawPlan(base, crossBox, runBox).plan;
    }
    const P_: StairDrawPlan = plan as StairDrawPlan;

    // entry face final: rotated -> LEFT/RIGHT, warna BOTTOM/TOP
    let face: "BOTTOM" | "TOP" | "LEFT" | "RIGHT";
    if (rotated) face = faceIn === "LEFT" ? "LEFT" : "RIGHT";
    else face = faceIn === "TOP" ? "TOP" : "BOTTOM";

    const R = P_.riserCount;
    const riserIn = (floorHeightFt * 12) / Math.max(1, R);
    const fwPx = P_.flightWidthFt * scale;
    const crossPx = P_.usedCrossFt * scale;
    const runPx = P_.usedRunFt * scale;
    const f1 = P_.flight1.depthsIn, f2 = P_.flight2.depthsIn, mid = P_.middle.depthsIn;
    const f1Px = P_.flight1.runFt * scale, f2Px = P_.flight2.runFt * scale;
    const x2 = Math.max(fwPx, crossPx - fwPx);          // flight-2 / landing-2 ka local x
    const flightsRunPx = Math.max(f1Px, f2Px);

    // local (planner frame) -> world (svg) mapping
    const toWorld = (lx: number, ly: number): [number, number] => {
      switch (face) {
        case "TOP":   return [x + crossPx - lx, y + runPx - ly];
        case "LEFT":  return [x + runPx - ly, y + lx];
        case "RIGHT": return [x + ly, y + lx];                 // C-shape: landings left, entry right (flight-1 upar wali row)
        default:      return [x + lx, y + ly];
      }
    };
    const matrix =
      face === "TOP" ? `matrix(-1 0 0 -1 ${x + crossPx} ${y + runPx})`
      : face === "LEFT" ? `matrix(0 1 -1 0 ${x + runPx} ${y})`
      : face === "RIGHT" ? `matrix(0 1 1 0 ${x} ${y})`
      : `matrix(1 0 0 1 ${x} ${y})`;

    const avg = (a: number[]) => (a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0);
    const fs = Math.max(1.5, Math.min(2.4, scale * 0.4));
    const lblFs = Math.min(2.5, fwPx * 0.12);

    // flight tread lines: landing se entry ki taraf (local y badhta hai)
    const flightTreadLines = (depths: number[], lx: number, key: string) => {
      const out: React.ReactNode[] = [];
      let acc = 0;
      for (let i = 0; i < depths.length - 1; i++) {
        acc += (depths[i] / 12) * scale;
        out.push(<line key={`${key}-${i}`} x1={lx} y1={fwPx + acc} x2={lx + fwPx} y2={fwPx + acc} stroke={LINE_PRIMARY} strokeWidth="0.4" />);
      }
      return out;
    };
    // middle tread lines: dono landings ke beech (local x badhta hai)
    const midTreadLines = () => {
      const out: React.ReactNode[] = [];
      let acc = 0;
      for (let i = 0; i < mid.length - 1; i++) {
        acc += (mid[i] / 12) * scale;
        out.push(<line key={`mid-${i}`} x1={fwPx + acc} y1={0} x2={fwPx + acc} y2={fwPx} stroke={LINE_PRIMARY} strokeWidth="0.4" />);
      }
      return out;
    };

    const [l1x, l1y] = toWorld(fwPx / 2, fwPx / 2);
    const [l2x, l2y] = toWorld(x2 + fwPx / 2, fwPx / 2);
    const [cx, cy] = toWorld(crossPx / 2, fwPx + flightsRunPx / 2);

    return (
      <g id="engine-validated-staircase" data-entry-face={face} data-rotated={rotated ? "1" : "0"}>
        <g id="c-shape-stair" transform={matrix}>
          {/* LANDING-1 (far end, x = 0) */}
          <rect x={0} y={0} width={fwPx} height={fwPx} fill="#f0f0f0" stroke={LINE_PRIMARY} strokeWidth="0.5" />
          {/* FLIGHT-1 (entry flight) */}
          <rect x={0} y={fwPx} width={fwPx} height={f1Px} fill="none" stroke={LINE_PRIMARY} strokeWidth="0.5" />
          {flightTreadLines(f1, 0, "f1")}
          <circle cx={fwPx / 2} cy={fwPx + f1Px - 2} r="0.9" fill={DOOR_COLOR} />
          <g transform={`translate(${fwPx / 2}, ${fwPx + f1Px / 2})`}>
            <line x1="0" y1="-3" x2="0" y2="3" stroke={DOOR_COLOR} strokeWidth="0.7" />
            <polygon points="0,-4.5 -1.5,-1 1.5,-1" fill={DOOR_COLOR} />
          </g>

          {/* MIDDLE : landing-1 <-> landing-2 treads (0 bhi ho sakte hain) */}
          <rect x={fwPx} y={0} width={Math.max(0, x2 - fwPx)} height={fwPx} fill="none" stroke={LINE_PRIMARY} strokeWidth="0.5" />
          {midTreadLines()}
          <rect x={fwPx} y={fwPx} width={Math.max(0, x2 - fwPx)} height={flightsRunPx} fill="none" stroke={LINE_PRIMARY} strokeWidth="0.3" strokeDasharray="2,2" />

          {/* LANDING-2 (far end, x = cross - fw) + FLIGHT-2 */}
          <rect x={x2} y={0} width={fwPx} height={fwPx} fill="#f0f0f0" stroke={LINE_PRIMARY} strokeWidth="0.5" />
          <rect x={x2} y={fwPx} width={fwPx} height={f2Px} fill="none" stroke={LINE_PRIMARY} strokeWidth="0.5" />
          {flightTreadLines(f2, x2, "f2")}
          <g transform={`translate(${x2 + fwPx / 2}, ${fwPx + f2Px / 2})`}>
            <line x1="0" y1="-3" x2="0" y2="3" stroke={DOOR_COLOR} strokeWidth="0.7" />
            <polygon points="0,4.5 -1.5,1 1.5,1" fill={DOOR_COLOR} />
          </g>
        </g>

        {/* TEXT: hamesha seedha (rotate nahi hota) */}
        <text x={l1x} y={l1y} fill={LINE_PRIMARY} fontSize={lblFs} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
          {fwPx > 8 ? "1ST LANDING" : "1ST LNDG"}
        </text>
        <text x={l2x} y={l2y} fill={LINE_PRIMARY} fontSize={lblFs} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
          {fwPx > 8 ? "2ND LANDING" : "2ND LNDG"}
        </text>
        <text x={cx} y={cy - fs * 0.6} fill={LINE_PRIMARY} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fontWeight="600">
          {`${R} R @ ${riserIn.toFixed(1)}"`}
        </text>
        <text x={cx} y={cy + fs * 0.7} fill={LINE_PRIMARY} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fontWeight="600">
          {`T ${avg(f1).toFixed(1)}"${mid.length ? ` / ${avg(mid).toFixed(1)}"` : ""}`}
        </text>
        {P_.shortTreads > 0 && (
          <text x={cx} y={cy + fs * 2} fill={WARN_COLOR} fontSize={fs * 0.9} textAnchor="middle" dominantBaseline="middle" fontWeight="700">
            {`SHORT ${P_.shortTreads} TREAD`}
          </text>
        )}
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
        <path d={arcPath} fill="none" stroke={DOOR_COLOR} strokeWidth="0.5" strokeDasharray="1.5,1.5" />
        <path d={shutterPath} stroke={DOOR_COLOR} strokeWidth="1.2" strokeLinecap="round" />
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
          <rect x={wx} y={wy} width={ww} height={wallThick} fill={BG_FILL} stroke={LINE_PRIMARY} strokeWidth="0.4" />
          <line x1={wx} y1={wy + wallThick * 0.3} x2={wx + ww} y2={wy + wallThick * 0.3} stroke={LINE_PRIMARY} strokeWidth="0.6" />
          <line x1={wx} y1={wy + wallThick * 0.7} x2={wx + ww} y2={wy + wallThick * 0.7} stroke={LINE_PRIMARY} strokeWidth="0.6" />
        </g>
      );
    }
    return (
      <g key={keyStr} id="cad-window-symbol">
        <rect x={wx} y={wy} width={wallThick} height={ww} fill={BG_FILL} stroke={LINE_PRIMARY} strokeWidth="0.4" />
        <line x1={wx + wallThick * 0.3} y1={wy} x2={wx + wallThick * 0.3} y2={wy + ww} stroke={LINE_PRIMARY} strokeWidth="0.6" />
        <line x1={wx + wallThick * 0.7} y1={wy} x2={wx + wallThick * 0.7} y2={wy + ww} stroke={LINE_PRIMARY} strokeWidth="0.6" />
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
    const OUTLINE = LINE_PRIMARY;
    const FILL = BG_FILL;

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
          if (o.wall === "TOP") return <rect key={`cut-t-${index}`} x={rx + off} y={ry - cutDepth / 2} width={span} height={cutDepth} fill={BG_FILL} />;
          if (o.wall === "BOTTOM") return <rect key={`cut-b-${index}`} x={rx + off} y={ry + rh - cutDepth / 2} width={span} height={cutDepth} fill={BG_FILL} />;
          if (o.wall === "LEFT") return <rect key={`cut-l-${index}`} x={rx - cutDepth / 2} y={ry + off} width={cutDepth} height={span} fill={BG_FILL} />;
          return <rect key={`cut-r-${index}`} x={rx + rw - cutDepth / 2} y={ry + off} width={cutDepth} height={span} fill={BG_FILL} />;
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
    const bg = BG_FILL;
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

  // =========================================================================
  // STAIR SHAPE DECISION (U ya C) — poori building ke liye EK hi faisla
  //   U-shape = entry NEECHE (BOTTOM/TOP), flights portrait  -> stair ke neeche/upar 3.5 ft khuli jagah chahiye
  //   C-shape = entry SIDE se (LEFT/RIGHT), landings ek side  -> stair ke side me 3.5 ft khuli jagah chahiye
  // Har candidate face har floor (ground + upper) par check hota hai:
  //   1) plan us rect me exact baithe (shortTreads = 0, treads 9"-11", riser count same)
  //   2) entry/arrival side par poori stair-width x 3.5 ft ka zone plan ke andar ho aur
  //      kisi bedroom / toilet / kitchen / parking / duct se na takraye (sirf living / passage / hall ke upar ho sakta hai)
  // Jo face sab floors par pass ho wahi use hota hai (ground = upper = tower). Koi sab par pass na ho to
  // sabse zyada floors par pass hone wala (console me warning aati hai).
  // =========================================================================
  const stairDecision = decideStairFace(processedFloors, floorData as any, floorRooms as any, stairFloorHeightFt);

  if (stairDecision && typeof console !== "undefined") {
    const k = `stair-decision-${stairDecision.face}-${stairDecision.summary}`;
    if (!cadStairDebugCache.has(k)) {
      cadStairDebugCache.add(k);
      const shape = stairDecision.face === "LEFT" || stairDecision.face === "RIGHT" ? "C-SHAPE (side entry)" : "U-SHAPE (front entry)";
      (stairDecision.allOk ? console.info : console.warn)(
        `[STAIR DECISION] ${shape} face=${stairDecision.face} allFloorsOk=${stairDecision.allOk}`, stairDecision.summary
      );
    }
  }

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

            <path d={outerWallPath} fill="url(#wallHatch)" fillRule="evenodd" stroke={LINE_PRIMARY} strokeWidth="0.8" strokeLinejoin="round" />
            <path d={`M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z`} fill="none" stroke={LINE_PRIMARY} strokeWidth="0.5" />

            <g id="internal-room-planning" clipPath={`url(#${clipId})`}>
              <rect x={i0.x} y={i0.y} width={clearInnerW} height={clearInnerH} fill={BG_FILL} stroke={LINE_PRIMARY} strokeWidth="0.5" />

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
                      entryFace: stairDecision
                        ? stairDecision.face
                        : ((rm as any)?.entryFace || (rm as any)?.stairMeta?.entryFace || (rm as any)?.staircaseSpec?.entryFace || floorInfo?.staircaseConfig?.entryFace),
                      rotated: stairDecision
                        ? (stairDecision.face === "LEFT" || stairDecision.face === "RIGHT")
                        : ((rm as any)?.rotated ?? (rm as any)?.stairMeta?.rotated ?? floorInfo?.staircaseConfig?.rotated),
                      lockFace: !!stairDecision,
                      staircaseSpec: {
                        ...(floorInfo?.staircase || {}),
                        ...((rm as any)?.stairMeta?.staircaseSpec || {}),
                        ...((rm as any)?.staircaseSpec || {}),
                        staircaseType: stairType,
                      },
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

                const rectFill = isDuct ? "url(#wallHatch)" : String(rm.name || "").toUpperCase() === "PASSAGE" ? "none" : BG_FILL;
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
                              entryFace: stairDecision ? stairDecision.face : embeddedStair.entryFace,
                              rotated: stairDecision
                                ? (stairDecision.face === "LEFT" || stairDecision.face === "RIGHT")
                                : (typeof embeddedStair.rotated === "boolean" ? embeddedStair.rotated : embeddedStair.renderHints?.rotated),
                              lockFace: !!stairDecision,
                              renderHints: embeddedStair.renderHints,
                            }
                          );
                        })()}
                      </g>
                    )}

                    {String(rm.name || "").toUpperCase() === "PASSAGE" && (rm as any).pinkGuideLines ? (
                      <g id={`passage-guide-${index}-${rIdx}`} pointerEvents="none">
                        {rw <= rh ? (
                          <>
                            <line x1={rx + 0.6} y1={ry} x2={rx + 0.6} y2={ry + rh} stroke={PASSAGE_COLOR} strokeWidth="1.1" />
                            <line x1={rx + rw - 0.6} y1={ry} x2={rx + rw - 0.6} y2={ry + rh} stroke={PASSAGE_COLOR} strokeWidth="1.1" />
                          </>
                        ) : (
                          <>
                            <line x1={rx} y1={ry + 0.6} x2={rx + rw} y2={ry + 0.6} stroke={PASSAGE_COLOR} strokeWidth="1.1" />
                            <line x1={rx} y1={ry + rh - 0.6} x2={rx + rw} y2={ry + rh - 0.6} stroke={PASSAGE_COLOR} strokeWidth="1.1" />
                          </>
                        )}
                        <text x={rx + rw / 2} y={ry + rh / 2} fill={PASSAGE_COLOR} fontSize={Math.max(2, Math.min(3.2, Math.min(rw, rh) * 0.10))} textAnchor="middle" dominantBaseline="middle" fontWeight="700" transform={rw <= rh ? `rotate(-90 ${rx + rw / 2} ${ry + rh / 2})` : undefined}>PASSAGE {Number((rm as any).corridorWidthFt || Math.min(rm.w || 0, rm.h || 0) || 0).toFixed(2)}'</text>
                      </g>
                    ) : null}
                    {isDuct && (
                      <g id="duct-cross-lines">
                        <line x1={rx} y1={ry} x2={rx + rw} y2={ry + rh} stroke={LINE_SECONDARY} strokeWidth="0.4" strokeDasharray="3,2" />
                        <line x1={rx + rw} y1={ry} x2={rx} y2={ry + rh} stroke={LINE_SECONDARY} strokeWidth="0.4" strokeDasharray="3,2" />
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
                              <text key={`title-${lineIdx}`} x={ln.x} y={ln.y} fill={isDuct ? DUCT_TEXT : TEXT_PRIMARY} fontSize={ln.fontSize} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                                {ln.text}
                              </text>
                            ) : (
                              <text key={`dim-${lineIdx}`} x={ln.x} y={ln.y} fill={TEXT_DIM} fontSize={ln.fontSize} fontWeight="600" textAnchor="middle" dominantBaseline="central">
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

            {/* section-cut symbols (A-A, B-B ...): same positions that drive the Section views */}
            {sectionMarkers.map((m) => (
              <CadSectionCutMarker key={`cut-${index}-${m.cut.id}`} cut={m.cut} posOuterFt={m.posOuterFt} scale={scale} box={{ minX: Math.min(p0.x, p1.x, p2.x, p3.x), maxX: Math.max(p0.x, p1.x, p2.x, p3.x), minY: Math.min(p0.y, p1.y, p2.y, p3.y), maxY: Math.max(p0.y, p1.y, p2.y, p3.y) }} />
            ))}

            <text x={centerPt.x} y={labelY} textAnchor="middle" dominantBaseline="middle" fill={TEXT_PRIMARY} style={{ fontWeight: "900", fontSize: "8.5px", fontFamily: "sans-serif" }}>
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