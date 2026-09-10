import React from "react";
import { formatDim, renderSideDim } from "./CadDimUtils";
import { FloorData, FloorRoom, PlacedDoor, PlacedWindow } from "../engine/planningTypes";
import { calculateStaircase } from "../engine/stairPlanner";
import { validateConstructionPlan, RenderedRoomBox } from "../engine/validationEngine";

// Prevent React re-renders from flooding the browser console.
const cadDiagnosticCache = new Set<string>();
const cadValidationCache = new Set<string>();

interface StaircaseConfig {
  treadCount?: number;
  landingDepth?: number;
  wellGapFt?: number;
  wallThicknessInch?: number;
  landingLabel?: string;
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

  const renderEngineStaircase = (
    x: number, y: number, w: number, h: number, 
    stairConfig?: StaircaseConfig, isBottomZone: boolean = true
  ) => {
    const engineSpecs = typeof calculateStaircase === "function" ? calculateStaircase(
      Number((stairConfig as any)?.floorToFloorHeight || 10),
      Number((stairConfig as any)?.targetRiserInches || 6.8),
      ((stairConfig as any)?.staircaseType || "DOG_LEGGED") as any
    ) : null;
    const treadsPerFlight = engineSpecs ? Math.max(4, Math.ceil(engineSpecs.riserCount / Math.max(1, engineSpecs.flightCount)) - 1) : 8;
    const treadsCount = Number((stairConfig as any)?.treadCount || treadsPerFlight);
    const landingDepth = Number((stairConfig as any)?.landingDepth || (engineSpecs?.landingWidth ?? 3.25)) * scale;
    const wellGap = Number((stairConfig as any)?.wellGapFt || 0.35) * scale;
    const outerWallPx = Number((stairConfig as any)?.wallThicknessInch || 4.5) / 12 * scale;
    const stairType = String((stairConfig as any)?.staircaseType || "DOG_LEGGED").toUpperCase();

    const flightW = Math.max(2, (w - wellGap) / 2);
    const flightH = Math.max(10, h - landingDepth);
    const treadStep = flightH / treadsCount;

    const landingY = isBottomZone ? y + h - landingDepth : y;
    const flightsY = isBottomZone ? y : y + landingDepth;

    return (
      <g id="engine-validated-staircase">
        <rect x={x} y={y} width={w} height={h} fill="#020617" stroke="#ef4444" strokeWidth={outerWallPx} />
        <rect x={x} y={landingY} width={w} height={landingDepth} fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
        <text x={x + w / 2} y={landingY + landingDepth / 2} fill="#38bdf8" fontSize={Math.min(3.5, w * 0.12)} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
          {w > 25 ? "LANDING" : "LNDG"}
        </text>

        {stairType === "STRAIGHT" ? (
          <g id="straight-stair">
            <rect x={x + w * 0.12} y={flightsY} width={w * 0.76} height={flightH} fill="none" stroke="#38bdf8" strokeWidth="0.5" />
            {Array.from({ length: treadsCount }).map((_, i) => (
              <line key={`s-${i}`} x1={x + w * 0.12} y1={flightsY + (i * treadStep)} x2={x + w * 0.88} y2={flightsY + (i * treadStep)} stroke="#38bdf8" strokeWidth="0.4" />
            ))}
          </g>
        ) : (
          <g id="multi-flight-stair">
            <rect x={x} y={flightsY} width={flightW} height={flightH} fill="none" stroke="#38bdf8" strokeWidth="0.5" />
            {Array.from({ length: treadsCount }).map((_, i) => (
              <line key={`f1-${i}`} x1={x} y1={flightsY + (i * treadStep)} x2={x + flightW} y2={flightsY + (i * treadStep)} stroke="#38bdf8" strokeWidth="0.4" />
            ))}
            <rect x={x + flightW + wellGap} y={flightsY} width={flightW} height={flightH} fill="none" stroke="#38bdf8" strokeWidth="0.5" />
            {Array.from({ length: treadsCount }).map((_, i) => (
              <line key={`f2-${i}`} x1={x + flightW + wellGap} y1={flightsY + (i * treadStep)} x2={x + w} y2={flightsY + (i * treadStep)} stroke="#38bdf8" strokeWidth="0.4" />
            ))}
          </g>
        )}

        <path
          d={isBottomZone 
            ? `M ${x + flightW / 2} ${y + h - 3} L ${x + flightW / 2} ${landingY + landingDepth / 2} L ${x + w - flightW / 2} ${landingY + landingDepth / 2} L ${x + w - flightW / 2} ${flightsY + 6}`
            : `M ${x + flightW / 2} ${y + 3} L ${x + flightW / 2} ${landingY + landingDepth / 2} L ${x + w - flightW / 2} ${landingY + landingDepth / 2} L ${x + w - flightW / 2} ${flightsY + flightH - 6}`
          }
          fill="none"
          stroke="#eab308"
          strokeWidth="0.8"
          strokeDasharray="2,1"
        />
        <circle cx={x + flightW / 2} cy={isBottomZone ? y + h - 3 : y + 3} r="1.2" fill="#eab308" />
        <text x={x + flightW / 2} y={isBottomZone ? y + h - 8 : y + 8} fill="#eab308" fontSize={Math.min(3.5, w * 0.1)} fontWeight="bold" textAnchor="middle">
          UP
        </text>
      </g>
    );
  };

  const renderCadDoorSymbol = (door: PlacedDoor, rx: number, ry: number, rw: number, rh: number, keyStr: string) => {
    const d = door as any;
    const dw = door.widthFeet * scale;
    const offset = door.offsetFeet * scale;
    const isDouble = Boolean(d.isDoubleLeaf || d.doubleLeaf || (d.leafCount && d.leafCount > 1) || d.doorType === "MAIN");

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
      if (door.wall === "BOTTOM") {
        dx = rx + offset;
        dy = ry + rh;
        shutterPath = `M ${dx} ${dy} L ${dx} ${dy - dw}`;
        arcPath = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 0 ${dx} ${dy - dw}`;
      } else if (door.wall === "TOP") {
        dx = rx + offset;
        dy = ry;
        shutterPath = `M ${dx} ${dy} L ${dx} ${dy + dw}`;
        arcPath = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 1 ${dx} ${dy + dw}`;
      } else if (door.wall === "LEFT") {
        dx = rx;
        dy = ry + offset;
        shutterPath = `M ${dx} ${dy} L ${dx + dw} ${dy}`;
        arcPath = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 0 ${dx + dw} ${dy}`;
      } else {
        dx = rx + rw;
        dy = ry + offset;
        shutterPath = `M ${dx} ${dy} L ${dx - dw} ${dy}`;
        arcPath = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 1 ${dx - dw} ${dy}`;
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

    let wx = rx;
    let wy = ry;
    const isHorizontal = win.wall === "TOP" || win.wall === "BOTTOM";

    if (win.wall === "BOTTOM") {
      wx = rx + offset;
      wy = ry + rh - wallThick / 2;
    } else if (win.wall === "TOP") {
      wx = rx + offset;
      wy = ry - wallThick / 2;
    } else if (win.wall === "LEFT") {
      wx = rx - wallThick / 2;
      wy = ry + offset;
    } else {
      wx = rx + rw - wallThick / 2;
      wy = ry + offset;
    }

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

  const openingStartEnd = (opening: any) => {
    const start = Math.max(0, Number(opening?.offsetFeet || 0));
    const end = start + Math.max(0, Number(opening?.widthFeet ?? opening?.lengthFeet ?? 0));
    return { start, end };
  };

  // ---------------------------------------------------------------------------
  // CAD WALL ENGINE – Dynamic Auto-Trimming Partition Walls with Closed Corners & T-Junctions
  // ---------------------------------------------------------------------------
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
        if (side === "TOP") {
          return Math.abs((other.y + other.h) - room.y) <= TOUCH_EPS &&
            Math.min(room.x + room.w, other.x + other.w) - Math.max(room.x, other.x) > 0.12;
        }
        if (side === "BOTTOM") {
          return Math.abs((room.y + room.h) - other.y) <= TOUCH_EPS &&
            Math.min(room.x + room.w, other.x + other.w) - Math.max(room.x, other.x) > 0.12;
        }
        if (side === "LEFT") {
          return Math.abs((other.x + other.w) - room.x) <= TOUCH_EPS &&
            Math.min(room.y + room.h, other.y + other.h) - Math.max(room.y, other.y) > 0.12;
        }
        return Math.abs((room.x + room.w) - other.x) <= TOUCH_EPS &&
          Math.min(room.y + room.h, other.y + other.h) - Math.max(room.y, other.y) > 0.12;
      });
    };

    const seenShared = new Set<string>();
    const edges: Edge[] = [];
    const internalAudit: any[] = [];

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

        let edgeX = room.x;
        let edgeY = room.y;
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
        edges.push({
          key: `${side}:${edgeX.toFixed(2)}:${edgeY.toFixed(2)}:${edgeLen.toFixed(2)}`,
          side, x: edgeX, y: edgeY, len: edgeLen, horizontal, room, other
        });

        internalAudit.push({
          room: room.name, other: other?.name || "OPEN / UNASSIGNED", side,
          length: Number(edgeLen.toFixed(2)), openingCount: 0,
        });
      }
    }

    // Dynamic Trim & T-Junction Intersection Engine
    const getTrimmedSpan = (edge: Edge) => {
      let start = edge.horizontal ? edge.x : edge.y;
      let end = start + edge.len;
      const fixedCoord = edge.horizontal ? edge.y : edge.x;
      let startConnected = false;
      let endConnected = false;

      // Check intersection with outer boundaries
      if (edge.horizontal) {
        if (Math.abs(start) <= EDGE_EPS) startConnected = true;
        if (Math.abs(end - clearInnerWFt) <= EDGE_EPS) endConnected = true;
      } else {
        if (Math.abs(start) <= EDGE_EPS) startConnected = true;
        if (Math.abs(end - clearInnerHFt) <= EDGE_EPS) endConnected = true;
      }

      // Check intersections with all other perpendicular partition walls
      edges.forEach((o) => {
        if (o === edge || o.horizontal === edge.horizontal) return;
        const oFixed = o.horizontal ? o.y : o.x;
        const oStart = o.horizontal ? o.x : o.y;
        const oEnd = oStart + o.len;

        // If perpendicular wall crosses our line's track
        if (oFixed <= fixedCoord + TOUCH_EPS && oFixed >= fixedCoord - TOUCH_EPS) {
          if (oStart <= start + TOUCH_EPS && oEnd >= start - TOUCH_EPS) {
            if (Math.abs(oStart - start) <= TOUCH_EPS) startConnected = true;
          }
          if (oStart <= end + TOUCH_EPS && oEnd >= end - TOUCH_EPS) {
            if (Math.abs(oEnd - end) <= TOUCH_EPS) endConnected = true;
          }
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
        const all = [
          ...(Array.isArray(room.doors) ? room.doors : []),
          ...(Array.isArray(room.windows) ? room.windows : []),
        ];
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

    const drawHorizontal = (edge: Edge) => {
      const trimmed = getTrimmedSpan(edge);
      if (trimmed.len <= 0.05) return;

      const openings = openingsForEdge(edge, trimmed.start, trimmed.end);
      const startX = trimmed.start;
      const endX = trimmed.end;

      const y1 = originY + edge.y * scale - halfWall;
      const y2 = originY + edge.y * scale + halfWall;

      if (!trimmed.startConnected) {
        pieces.push(
          <line key={`cap-h-start-${edge.key}`} x1={originX + startX * scale} y1={y1} x2={originX + startX * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />
        );
      }

      let cursor = startX;
      openings.forEach((o, idx) => {
        const a = Math.max(startX, o.start);
        const b = Math.min(endX, o.end);
        if (a > cursor + 0.02) {
          pieces.push(
            <React.Fragment key={`ph-${edge.key}-${idx}`}>
              <line x1={originX + cursor * scale} y1={y1} x2={originX + a * scale} y2={y1} stroke="#ef4444" strokeWidth="0.32" />
              <line x1={originX + cursor * scale} y1={y2} x2={originX + a * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />
            </React.Fragment>
          );
        }
        pieces.push(
          <React.Fragment key={`jamb-h-${edge.key}-${idx}`}>
            <line x1={originX + a * scale} y1={y1} x2={originX + a * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />
            <line x1={originX + b * scale} y1={y1} x2={originX + b * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />
          </React.Fragment>
        );
        cursor = Math.max(cursor, b);
      });

      if (cursor < endX - 0.02) {
        pieces.push(
          <React.Fragment key={`phe-${edge.key}`}>
            <line x1={originX + cursor * scale} y1={y1} x2={originX + endX * scale} y2={y1} stroke="#ef4444" strokeWidth="0.32" />
            <line x1={originX + cursor * scale} y1={y2} x2={originX + endX * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />
          </React.Fragment>
        );
      }

      if (!trimmed.endConnected) {
        pieces.push(
          <line key={`cap-h-end-${edge.key}`} x1={originX + endX * scale} y1={y1} x2={originX + endX * scale} y2={y2} stroke="#ef4444" strokeWidth="0.32" />
        );
      }
    };

    const drawVertical = (edge: Edge) => {
      const trimmed = getTrimmedSpan(edge);
      if (trimmed.len <= 0.05) return;

      const openings = openingsForEdge(edge, trimmed.start, trimmed.end);
      const startY = trimmed.start;
      const endY = trimmed.end;

      const x1 = originX + edge.x * scale - halfWall;
      const x2 = originX + edge.x * scale + halfWall;

      if (!trimmed.startConnected) {
        pieces.push(
          <line key={`cap-v-start-${edge.key}`} x1={x1} y1={originY + startY * scale} x2={x2} y2={originY + startY * scale} stroke="#ef4444" strokeWidth="0.32" />
        );
      }

      let cursor = startY;
      openings.forEach((o, idx) => {
        const a = Math.max(startY, o.start);
        const b = Math.min(endY, o.end);
        if (a > cursor + 0.02) {
          pieces.push(
            <React.Fragment key={`pv-${edge.key}-${idx}`}>
              <line x1={x1} y1={originY + cursor * scale} x2={x1} y2={originY + a * scale} stroke="#ef4444" strokeWidth="0.32" />
              <line x1={x2} y1={originY + cursor * scale} x2={x2} y2={originY + a * scale} stroke="#ef4444" strokeWidth="0.32" />
            </React.Fragment>
          );
        }
        pieces.push(
          <React.Fragment key={`jamb-v-${edge.key}-${idx}`}>
            <line x1={x1} y1={originY + a * scale} x2={x2} y2={originY + a * scale} stroke="#ef4444" strokeWidth="0.32" />
            <line x1={x1} y1={originY + b * scale} x2={x2} y2={originY + b * scale} stroke="#ef4444" strokeWidth="0.32" />
          </React.Fragment>
        );
        cursor = Math.max(cursor, b);
      });

      if (cursor < endY - 0.02) {
        pieces.push(
          <React.Fragment key={`pve-${edge.key}`}>
            <line x1={x1} y1={originY + cursor * scale} x2={x1} y2={originY + endY * scale} stroke="#ef4444" strokeWidth="0.32" />
            <line x1={x2} y1={originY + cursor * scale} x2={x2} y2={originY + endY * scale} stroke="#ef4444" strokeWidth="0.32" />
          </React.Fragment>
        );
      }

      if (!trimmed.endConnected) {
        pieces.push(
          <line key={`cap-v-end-${edge.key}`} x1={x1} y1={originY + endY * scale} x2={x2} y2={originY + endY * scale} stroke="#ef4444" strokeWidth="0.32" />
        );
      }
    };

    edges.forEach((edge) => {
      if (edge.horizontal) drawHorizontal(edge);
      else drawVertical(edge);
    });

    return {
      node: <g id="architectural-4inch-partition-walls">{pieces}</g>,
      audit: internalAudit,
      edgeCount: edges.length,
    };
  };

  const renderOpeningCuts = (rm: any, rx: number, ry: number, rw: number, rh: number) => {
    const openings = [
      ...(Array.isArray(rm.doors) ? rm.doors : []),
      ...(Array.isArray(rm.windows) ? rm.windows : []),
    ];
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

  // ---------------------------------------------------------------------------
  // EXTERNAL WALL CUTS – rendered outside the inner clip so they actually
  // break the 9‑inch outer wall ring (fixes main gate not showing).
  // ---------------------------------------------------------------------------
  const renderExternalWallCuts = (
    roomList: any[],
    clearInnerWFt: number,
    clearInnerHFt: number,
    innerX: number,
    innerY: number,
    outerX: number,
    outerY: number,
    outerW: number,
    outerH: number,
    outerWallThicknessFt: number,
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
        let shiftX = 0;
        let shiftY = 0;

        if (processedFloors.length > 1) {
          const rowIndex = Math.floor(index / itemsPerRow);
          const colIndex = rowIndex % 2 === 0 
            ? (itemsPerRow - 1) - (index % itemsPerRow) 
            : (index % itemsPerRow);

          shiftX = plotGap + (colIndex * (baseBuiltUpWidth + interFloorGap));
          shiftY = rowIndex * rowHeightGap;
        } else {
          shiftX = plotGap;
          shiftY = 0;
        }

        const currFloorPoints = getFloorPoints(floorName);
        const translatedPoints = currFloorPoints.map((p) => ({
          x: p.x - shiftX,
          y: p.y - shiftY,
        }));

        const p0 = translatedPoints[0];
        const p1 = translatedPoints[1];
        const p2 = translatedPoints[2];
        const p3 = translatedPoints[3];

        const floorInfo: any = getFloorInfo(floorName);

        const outerWallThicknessFt = floorInfo?.outerWallThickness || (9 / 12);
        const outerWallPx = outerWallThicknessFt * scale;

        const i0 = { x: p0.x + outerWallPx, y: p0.y + outerWallPx };
        const i1 = { x: p1.x - outerWallPx, y: p1.y + outerWallPx };
        const i2 = { x: p2.x - outerWallPx, y: p2.y - outerWallPx };
        const i3 = { x: p3.x + outerWallPx, y: p3.y - outerWallPx };

        const plotWidthPx = Math.abs(p1.x - p0.x);
        const clearInnerW = Math.abs(i1.x - i0.x);
        const clearInnerH = Math.abs(i3.y - i0.y);
        const clearInnerWFt = clearInnerW / scale;
        const clearInnerHFt = clearInnerH / scale;

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
        // Use generated geometry first – this is the source of truth for rooms & openings.
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

        const renderBoxesForValidation: RenderedRoomBox[] = roomList.map((r) => ({
          name: r.name || "ROOM",
          x: r.x || 0,
          y: r.y || 0,
          w: r.w || 0,
          h: r.h || 0,
          type: r.type || "room",
          doors: r.doors,
          windows: r.windows,
        }));

        let validationReport: { isValid: boolean; errors: string[]; warnings: string[] } = {
          isValid: true,
          errors: [],
          warnings: [],
        };

        if (typeof validateConstructionPlan === "function") {
          try {
            const plotAreaToValidate = baseArea || (clearInnerWFt * clearInnerHFt);
            const result = validateConstructionPlan(
              plotAreaToValidate,
              [floorName],
              floorData,
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
              const validationSignature = JSON.stringify({
                floor: floorName,
                valid: result.isValid ?? true,
                errors: validationReport.errors,
                warnings: validationReport.warnings,
                rooms: renderBoxesForValidation.map((r: any) => ({ name:r.name, x:+r.x.toFixed(2), y:+r.y.toFixed(2), w:+r.w.toFixed(2), h:+r.h.toFixed(2), doors:r.doors?.length || 0, windows:r.windows?.length || 0 }))
              });
              if (!cadValidationCache.has(validationSignature)) {
                cadValidationCache.add(validationSignature);
                console.groupCollapsed(`[CAD VALIDATION] ${floorName}`);
                console.log('SOURCE → engine/validationEngine.ts');
                console.log('VALID:', result.isValid ?? true);
                console.log('ERRORS:', validationReport.errors);
                console.log('WARNINGS:', validationReport.warnings);
                console.log('ROOM GEOMETRY:', renderBoxesForValidation.map((r: any) => ({ name:r.name, x:+r.x.toFixed(2), y:+r.y.toFixed(2), w:+r.w.toFixed(2), h:+r.h.toFixed(2), doors:r.doors?.length || 0, windows:r.windows?.length || 0 })));
                console.log('DIAGNOSTIC ROUTE:', {
                  'missing/incorrect room geometry': 'engine/roomPlanner.ts',
                  'missing/incorrect door/gate data': 'engine/openingPlanner.ts',
                  'partition/external wall rendering': 'components/CadFloorPlansView.tsx',
                  'connectivity/validation rejection': 'engine/validationEngine.ts'
                });
                console.groupEnd();
              }
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
                const isDuct = rm.type === "duct" || 
                  rm.name?.toUpperCase().includes("DUCT") || 
                  rm.name?.toUpperCase().includes("OTS") || 
                  rm.name?.toUpperCase().includes("SHAFT");

                const isBottomZone = ((rm.y || 0) + (rm.h || 0)) >= clearInnerHFt * 0.65;

                // ---- OVERLAP DETECTION (DEBUGGING) ----
                let hasOverlap = false;
                for (const other of roomList) {
                  if (other === rm) continue;
                  const ox = i0.x + (other.x || 0) * scale;
                  const oy = i0.y + (other.y || 0) * scale;
                  const ow = (other.w || 0) * scale;
                  const oh = (other.h || 0) * scale;
                  if (rx < ox + ow && rx + rw > ox &&
                      ry < oy + oh && ry + rh > oy) {
                    hasOverlap = true;
                    break;
                  }
                }

                if (isStaircase) {
                  return (
                    <g key={rIdx}>
                      {renderEngineStaircase(rx, ry, rw, rh, floorInfo?.staircaseConfig, isBottomZone)}
                    </g>
                  );
                }

                const fontTitleSize = Math.min(rw * 0.14, rh * 0.20, 4.0 * (scale / 5.5));
                const fontDimSize = Math.min(rw * 0.11, rh * 0.16, 3.2 * (scale / 5.5));

                const rectFill = isDuct ? "url(#wallHatch)" : String(rm.name || "").toUpperCase() === "PASSAGE" ? "none" : "#020617";
                const rectStroke = hasOverlap ? "#ff0000" : "none";
                const rectStrokeWidth = hasOverlap ? 2 : 0;

                return (
                  <g key={rIdx}>
                    <defs>
                      <clipPath id={`room-label-clip-${index}-${rIdx}`}>
                        <rect x={rx + 1} y={ry + 1} width={Math.max(1, rw - 2)} height={Math.max(1, rh - 2)} />
                      </clipPath>
                    </defs>

                    <rect
                      x={rx}
                      y={ry}
                      width={rw}
                      height={rh}
                      fill={rectFill}
                      stroke={rectStroke}
                      strokeWidth={rectStrokeWidth}
                    />

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

                    <g clipPath={`url(#room-label-clip-${index}-${rIdx})`}>
                      {getFitLabel(rm.name || "ROOM", rm.w || 0).map((line, lineIdx) => (
                        <text
                          key={`title-${lineIdx}`}
                          x={rx + rw / 2}
                          y={ry + rh * (0.34 + lineIdx * 0.14)}
                          fill={isDuct ? "#94a3b8" : "#ffffff"}
                          fontSize={Math.max(2.0, Math.min(fontTitleSize, rw / Math.max(4, line.length * 0.55)))}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="central"
                          style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "0.9px" }}
                        >
                          {line}
                        </text>
                      ))}

                      <text
                        x={rx + rw / 2}
                        y={ry + rh * (getFitLabel(rm.name || "ROOM", rm.w || 0).length > 1 ? 0.76 : 0.68)}
                        fill="#38bdf8"
                        fontSize={Math.max(1.6, Math.min(fontDimSize, rw * 0.12, rh * 0.13))}
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "0.7px" }}
                      >
                        {formatDim(rw, scale, measurementUnit)} x {formatDim(rh, scale, measurementUnit)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

            {(() => {
              const wallAudit = renderPartitionWalls(roomList, clearInnerWFt, clearInnerHFt, i0.x, i0.y);
              const diagnosticPayload = {
                floor: floorName,
                sourceFile: "components/CadFloorPlansView.tsx",
                internalPartitionEdges: wallAudit.edgeCount,
                internalPartitionAudit: wallAudit.audit,
                openingAudit: roomList.map((r: any) => ({
                  room: r.name,
                  doors: (r.doors || []).map((d: any) => ({ id: d.id, wall: d.wall, offsetFeet: d.offsetFeet, widthFeet: d.widthFeet, type: d.doorType })),
                  windows: (r.windows || []).map((w: any) => ({ id: w.id, wall: w.wall, offsetFeet: w.offsetFeet, lengthFeet: w.lengthFeet })),
                })),
                diagnosis: wallAudit.edgeCount === 0
                  ? "NO INTERNAL PARTITION EDGE WAS DERIVED FROM FINAL ROOM GEOMETRY. Inspect roomPlanner.ts coordinates/touching."
                  : "Internal partition geometry derived from final room edges.",
                externalWallRule: "External openings are cut after the outer wall ring and outside the inner clip.",
              };
              const signature = JSON.stringify({ floor: floorName, rooms: roomList.map((r: any) => [r.id, r.x, r.y, r.w, r.h, (r.doors || []).length, (r.windows || []).length]), edgeCount: wallAudit.edgeCount });
              if (!cadDiagnosticCache.has(signature)) {
                cadDiagnosticCache.add(signature);
                console.groupCollapsed(`[CAD DIAGNOSTIC] ${floorName}`);
                console.log("SOURCE → components/CadFloorPlansView.tsx");
                console.log("WALL AUDIT →", diagnosticPayload);
                console.log("NEXT CHECK → roomPlanner.ts if partition edge count/coordinates are wrong; openingPlanner.ts if gate/door data is wrong; validationEngine.ts if graph still rejects the plan.");
                console.groupEnd();
              }
              return (
                <>
                  {renderExternalWallCuts(
                    roomList, clearInnerWFt, clearInnerHFt, i0.x, i0.y, p0.x, p0.y,
                    plotWidthPx, Math.abs(p3.y - p0.y), outerWallThicknessFt
                  )}
                  {wallAudit.node}
                  <g id={`cad-opening-symbols-${index}`}>
                    {roomList.map((rm: any, rIdx: number) => {
                      const rx = i0.x + (rm.x || 0) * scale;
                      const ry = i0.y + (rm.y || 0) * scale;
                      const rw = (rm.w || 0) * scale;
                      const rh = (rm.h || 0) * scale;
                      return (
                        <React.Fragment key={`openings-${rIdx}`}>
                          {renderOpeningCuts(rm, rx, ry, rw, rh)}
                          {rm.doors?.map((door: PlacedDoor, dIdx: number) => (door as any).renderSymbol === false ? null :
                            renderCadDoorSymbol(door, rx, ry, rw, rh, `door-${rIdx}-${dIdx}`)
                          )}
                          {rm.windows?.map((win: PlacedWindow, wIdx: number) =>
                            renderCadWindowSymbol(win, rx, ry, rw, rh, `win-${rIdx}-${wIdx}`)
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

            <text 
              x={centerPt.x} 
              y={labelY} 
              textAnchor="middle" 
              dominantBaseline="middle" 
              fill="#000000" 
              style={{ fontWeight: "900", fontSize: "8.5px", fontFamily: "sans-serif", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "3px" }}
            >
              {floorName}
            </text>

            <g id="engine-validation-badge" transform={`translate(${p0.x}, ${p0.y - (10 * scale)})`}>
              <rect
                x="0"
                y="0"
                width={plotWidthPx}
                height={6 * scale}
                fill={validationReport.isValid ? "#064e3b" : "#7f1d1d"}
                rx="2"
              />
              <text
                x={plotWidthPx / 2}
                y={3 * scale}
                fill="#ffffff"
                fontSize={2.8 * scale}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {validationReport.isValid ? "✓ PLAN VALIDATED BY ENGINE" : `⚠ INVALID PLAN (${validationReport.errors.length} ERRORS)`}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}