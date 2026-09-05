import React from "react";
import { formatDim, renderSideDim } from "./CadDimUtils";
import { FloorData, FloorRoom, PlacedDoor, PlacedWindow } from "../engine/planningTypes";
import { calculateStaircase } from "../engine/stairPlanner";
import { validateConstructionPlan, RenderedRoomBox } from "../engine/validationEngine";

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

  // Logic to render 4-inch partition walls with corner sealing & open space merging
  const renderRoomWallLines = (
    rm: any, 
    rx: number, 
    ry: number, 
    rw: number, 
    rh: number, 
    roomList: any[],
    clearInnerWFt: number,
    clearInnerHFt: number
  ) => {
    const wallThick = (4 / 12) * scale; 
    const halfWall = wallThick / 2;

    const rwFt = rw / scale;
    const rhFt = rh / scale;

    // 1. Outer boundary detection (External walls should not duplicate partition lines)
    const isOuterTop = Math.abs(rm.y) < 0.1;
    const isOuterLeft = Math.abs(rm.x) < 0.1;
    const isOuterBottom = Math.abs((rm.y + rm.h) - clearInnerHFt) < 0.1;
    const isOuterRight = Math.abs((rm.x + rm.w) - clearInnerWFt) < 0.1;

    // 2. Continuous Open Space / Parking merging logic
    const isSameOpenArea = (r1: any, r2: any) => {
      if (!r1 || !r2) return false;
      const n1 = (r1.name || "").toUpperCase();
      const n2 = (r2.name || "").toUpperCase();
      if (n1.includes("PARKING") && n2.includes("PARKING")) return true;
      if (r1.isOpen || r2.isOpen) return true;
      return false;
    };

    // Check adjacent rooms
    const roomAbove = roomList.find((other) =>
      other !== rm &&
      Math.abs((other.y + other.h) - rm.y) < 0.15 &&
      Math.max(rm.x, other.x) < Math.min(rm.x + rm.w, other.x + other.w) - 0.1
    );

    const roomLeft = roomList.find((other) =>
      other !== rm &&
      Math.abs((other.x + other.w) - rm.x) < 0.15 &&
      Math.max(rm.y, other.y) < Math.min(rm.y + rm.h, other.y + other.h) - 0.1
    );

    const hasRoomBelow = roomList.some((other) =>
      other !== rm &&
      Math.abs((rm.y + rm.h) - other.y) < 0.15 &&
      Math.max(rm.x, other.x) < Math.min(rm.x + rm.w, other.x + other.w) - 0.1
    );

    const hasRoomRight = roomList.some((other) =>
      other !== rm &&
      Math.abs((rm.x + rm.w) - other.x) < 0.15 &&
      Math.max(rm.y, other.y) < Math.min(rm.y + rm.h, other.y + other.h) - 0.1
    );

    // Every room owns its four partition edges. Shared edges are intentionally drawn
    // as a double 4-inch wall; we do not suppress one side of a shared boundary.
    // Open-area parking/terrace zones are the only exception.
    const roomBelow = roomList.find((other) =>
      other !== rm && Math.abs((rm.y + rm.h) - other.y) < 0.15 &&
      Math.max(rm.x, other.x) < Math.min(rm.x + rm.w, other.x + other.w) - 0.1
    );
    const roomRight = roomList.find((other) =>
      other !== rm && Math.abs((rm.x + rm.w) - other.x) < 0.15 &&
      Math.max(rm.y, other.y) < Math.min(rm.y + rm.h, other.y + other.h) - 0.1
    );

    // A shared partition belongs to exactly ONE renderer instance. Previously both
    // rooms suppressed their common edge, which made internal walls disappear.
    // Draw the shared 4-inch wall from the lower-index room only; this also prevents
    // duplicate thick lines at room junctions.
    const selfIndex = roomList.indexOf(rm);
    const drawShared = (other: any) => !other || selfIndex < roomList.indexOf(other);
    const shouldDrawTop = !isOuterTop && (!roomAbove || isSameOpenArea(rm, roomAbove) ? false : drawShared(roomAbove));
    const shouldDrawLeft = !isOuterLeft && (!roomLeft || isSameOpenArea(rm, roomLeft) ? false : drawShared(roomLeft));
    const shouldDrawBottom = !isOuterBottom && (!roomBelow || isSameOpenArea(rm, roomBelow) ? false : drawShared(roomBelow));
    const shouldDrawRight = !isOuterRight && (!roomRight || isSameOpenArea(rm, roomRight) ? false : drawShared(roomRight));

    const getWallOpenings = (wall: string) => {
      let ops = [
        ...(Array.isArray(rm.doors) ? rm.doors : []),
        ...(Array.isArray(rm.windows) ? rm.windows : []),
      ].filter((o: any) => o.wall === wall);

      if (wall === "TOP" && roomAbove) {
        const aboveOps = [
          ...(Array.isArray(roomAbove.doors) ? roomAbove.doors : []),
          ...(Array.isArray(roomAbove.windows) ? roomAbove.windows : []),
        ].filter((o: any) => o.wall === "BOTTOM");
        ops = [...ops, ...aboveOps];
      }

      if (wall === "LEFT" && roomLeft) {
        const leftOps = [
          ...(Array.isArray(roomLeft.doors) ? roomLeft.doors : []),
          ...(Array.isArray(roomLeft.windows) ? roomLeft.windows : []),
        ].filter((o: any) => o.wall === "RIGHT");
        ops = [...ops, ...leftOps];
      }

      return ops;
    };

    // Extended lines at corners to seal closed joints perfectly
    const drawHorizontalDouble = (wall: string, centerY: number, totalFt: number) => {
      const ops = getWallOpenings(wall);
      const intervals = ops
        .map(openingStartEnd)
        .sort((a: any, b: any) => a.start - b.start);

      const y1 = centerY - halfWall;
      const y2 = centerY + halfWall;

      const pieces: React.ReactElement[] = [];
      let cursor = 0;
      for (const it of intervals) {
        const a = Math.max(0, Math.min(totalFt, it.start));
        const b = Math.max(a, Math.min(totalFt, it.end));
        if (a - cursor > 0.05) {
          const xStart = rx + cursor * scale - (cursor === 0 ? halfWall : 0);
          const xEnd = rx + a * scale + (a === totalFt ? halfWall : 0);
          pieces.push(
            <React.Fragment key={`${wall}-seg-${cursor}`}>
              <line x1={xStart} y1={y1} x2={xEnd} y2={y1} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
              <line x1={xStart} y1={y2} x2={xEnd} y2={y2} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
            </React.Fragment>
          );
        }
        cursor = Math.max(cursor, b);
      }
      if (totalFt - cursor > 0.05) {
        const xStart = rx + cursor * scale - (cursor === 0 ? halfWall : 0);
        const xEnd = rx + totalFt * scale + halfWall;
        pieces.push(
          <React.Fragment key={`${wall}-seg-end`}>
            <line x1={xStart} y1={y1} x2={xEnd} y2={y1} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
            <line x1={xStart} y1={y2} x2={xEnd} y2={y2} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
          </React.Fragment>
        );
      }
      return pieces;
    };

    const drawVerticalDouble = (wall: string, centerX: number, totalFt: number) => {
      const ops = getWallOpenings(wall);
      const intervals = ops
        .map(openingStartEnd)
        .sort((a: any, b: any) => a.start - b.start);

      const x1 = centerX - halfWall;
      const x2 = centerX + halfWall;

      const pieces: React.ReactElement[] = [];
      let cursor = 0;
      for (const it of intervals) {
        const a = Math.max(0, Math.min(totalFt, it.start));
        const b = Math.max(a, Math.min(totalFt, it.end));
        if (a - cursor > 0.05) {
          const yStart = ry + cursor * scale - (cursor === 0 ? halfWall : 0);
          const yEnd = ry + a * scale + (a === totalFt ? halfWall : 0);
          pieces.push(
            <React.Fragment key={`${wall}-seg-${cursor}`}>
              <line x1={x1} y1={yStart} x2={x1} y2={yEnd} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
              <line x1={x2} y1={yStart} x2={x2} y2={yEnd} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
            </React.Fragment>
          );
        }
        cursor = Math.max(cursor, b);
      }
      if (totalFt - cursor > 0.05) {
        const yStart = ry + cursor * scale - (cursor === 0 ? halfWall : 0);
        const yEnd = ry + totalFt * scale + halfWall;
        pieces.push(
          <React.Fragment key={`${wall}-seg-end`}>
            <line x1={x1} y1={yStart} x2={x1} y2={yEnd} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
            <line x1={x2} y1={yStart} x2={x2} y2={yEnd} stroke="#ef4444" strokeWidth="0.32" strokeLinecap="square" />
          </React.Fragment>
        );
      }
      return pieces;
    };

    return (
      <g id="clean-single-4inch-partition-walls">
        {shouldDrawTop && drawHorizontalDouble("TOP", ry, rwFt)}
        {shouldDrawLeft && drawVerticalDouble("LEFT", rx, rhFt)}
        {shouldDrawBottom && drawHorizontalDouble("BOTTOM", ry + rh, rwFt)}
        {shouldDrawRight && drawVerticalDouble("RIGHT", rx + rw, rhFt)}
      </g>
    );
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

        const outerWallThicknessFt = floorInfo?.outerWallThickness || (8 / 12);
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
        const roomEntries = Array.isArray(dynamicFloorRooms)
          ? dynamicFloorRooms
          : dynamicFloorRooms
            ? Object.values(dynamicFloorRooms)
            : Array.isArray(generatedFromFloorData)
              ? generatedFromFloorData
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
              console.groupCollapsed(`[CAD VALIDATION] ${floorName}`);
              console.log('VALID:', result.isValid ?? true);
              console.log('ERRORS:', validationReport.errors);
              console.log('WARNINGS:', validationReport.warnings);
              console.log('ROOM GEOMETRY:', renderBoxesForValidation.map((r: any) => ({ name:r.name, x:+r.x.toFixed(2), y:+r.y.toFixed(2), w:+r.w.toFixed(2), h:+r.h.toFixed(2), doors:r.doors?.length || 0, windows:r.windows?.length || 0 })));
              console.groupEnd();
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

                if (isStaircase) {
                  return (
                    <g key={rIdx}>
                      {renderEngineStaircase(rx, ry, rw, rh, floorInfo?.staircaseConfig, isBottomZone)}
                    </g>
                  );
                }

                const fontTitleSize = Math.min(rw * 0.14, rh * 0.20, 4.0 * (scale / 5.5));
                const fontDimSize = Math.min(rw * 0.11, rh * 0.16, 3.2 * (scale / 5.5));

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
                      fill={isDuct ? "url(#wallHatch)" : String(rm.name || "").toUpperCase() === "PASSAGE" ? "none" : "#020617"}
                      stroke={isDuct ? "#475569" : "none"}
                      strokeWidth="0.5"
                    />

                    {String(rm.name || "").toUpperCase() === "PASSAGE" && (rm as any).pinkGuideLines ? (
                      <g id={`passage-guide-${index}-${rIdx}`} pointerEvents="none">
                        <line x1={rx} y1={ry + 0.6} x2={rx + rw} y2={ry + 0.6} stroke="#ec4899" strokeWidth="1.1" />
                        <line x1={rx} y1={ry + rh - 0.6} x2={rx + rw} y2={ry + rh - 0.6} stroke="#ec4899" strokeWidth="1.1" />
                        <text x={rx + rw / 2} y={ry + rh / 2} fill="#ec4899" fontSize={Math.max(2, Math.min(3.2, rw * 0.025))} textAnchor="middle" dominantBaseline="middle" fontWeight="700">PASSAGE {Number((rm as any).corridorWidthFt || rm.h || 0).toFixed(2)}'</text>
                      </g>
                    ) : renderRoomWallLines(rm, rx, ry, rw, rh, roomList, clearInnerWFt, clearInnerHFt)}
                    {/* Opening cuts MUST be painted after wall lines, otherwise the wall is visually closed again. */}
                    {renderOpeningCuts(rm, rx, ry, rw, rh)}

                    {rm.doors?.map((door: PlacedDoor, dIdx: number) => (door as any).renderSymbol === false ? null :
                      renderCadDoorSymbol(door, rx, ry, rw, rh, `door-${rIdx}-${dIdx}`)
                    )}

                    {rm.windows?.map((win: PlacedWindow, wIdx: number) =>
                      renderCadWindowSymbol(win, rx, ry, rw, rh, `win-${rIdx}-${wIdx}`)
                    )}

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