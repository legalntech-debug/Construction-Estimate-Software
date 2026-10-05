import React from "react";
import { formatDim, renderTopWidthDim, renderHeightDim, renderEarthSymbol } from "./CadDimUtils";
import SectionDrawing from "./SectionDrawing";
import ElevationDrawing from "./ElevationDrawing";
import { buildSectionContext, type SectionCutDef } from "../engine/sectionEngine";

// 🎨 LIGHT THEME COLORS (White background + Black lines)
const LINE_COLOR = "#000000";         // Primary line color (was #ffffff / #00aaff)
const LABEL_BG = "#ffffff";           // Label background (was #000000)
const LABEL_TEXT = "#000000";         // Label text (was #00aaff / #ffffff)
const ACCENT_COLOR = "#1e40af";       // Accent (was #059669 green → dark blue)
const WARN_COLOR = "#dc2626";         // Warning (was #2563eb)

interface CadElevationSectionViewProps {
  elevationStartX: number;
  sectionStartX: number;
  elevationHeight: number;
  sectionHeight: number;
  baseBuiltUpWidth: number;
  baseBuiltUpHeight: number;
  scale: number;
  processedFloors: string[];
  floorData: Record<string, any>;
  hasBasement: boolean;
  basementHeight?: number;
  frontMos?: number;
  backMos?: number;
  widthColumnCount: number;
  depthColumnCount: number;
  effectiveMainFloorsCount: number;
  hasTowerSelected: boolean;
  measurementUnit?: "FEET" | "METERS";
  sectionLineX?: number;
  floorRooms?: Record<string, any>;
  renderBuildingStructure: (startX: number, totalWidth: number, colCount: number, isSection: boolean, showDims: boolean) => React.ReactNode;
  renderRightFloorLabels: (startX: number, width: number) => React.ReactNode;
}

export default function CadElevationSectionView({
  elevationStartX,
  sectionStartX,
  elevationHeight,
  sectionHeight,
  baseBuiltUpWidth,
  baseBuiltUpHeight,
  scale,
  processedFloors,
  floorData,
  hasBasement,
  basementHeight,
  frontMos = 10,
  backMos = 5,
  widthColumnCount,
  depthColumnCount,
  effectiveMainFloorsCount,
  hasTowerSelected,
  measurementUnit,
  sectionLineX = 2,
  floorRooms = {},
  renderBuildingStructure,
  renderRightFloorLabels,
}: CadElevationSectionViewProps) {
  // ============================================================
  // ACTUAL floor dimensions from floorData
  // ============================================================
  const getFloorHeightFt = (floorName: string): number => {
    const fData = floorData?.[floorName] || {};
    const v1 = Number(fData.floorToFloorHeightFeet);
    if (Number.isFinite(v1) && v1 > 0) return v1;
    const v2 = Number(fData.planningSettings?.floorToFloorHeightFeet);
    if (Number.isFinite(v2) && v2 > 0) return v2;
    const v3 = Number(fData.settings?.floorToFloorHeightFeet);
    if (Number.isFinite(v3) && v3 > 0) return v3;
    return 10;
  };

  const getSlabThicknessFt = (floorName: string): number => {
    const fData = floorData?.[floorName] || {};
    const inchValue = Number(fData.slabThicknessInch);
    if (Number.isFinite(inchValue) && inchValue > 0) return inchValue / 12;
    const feetValue = Number(fData.slabThicknessFeet);
    if (Number.isFinite(feetValue) && feetValue > 0) return feetValue;
    return 0.5;
  };

  const getPlinthHeightFt = (): number => {
    const firstFloor = processedFloors[0];
    const fData = floorData?.[firstFloor] || {};
    const v = Number(fData.plinthHeightFeet);
    if (Number.isFinite(v) && v > 0) return v;
    return 1.5;
  };

  const getWallThicknessFt = (): number => {
    const firstFloor = processedFloors[0];
    const fData = floorData?.[firstFloor] || {};
    const v = Number(fData.outerWallThickness);
    if (Number.isFinite(v) && v > 0) return v;
    return 8 / 12;
  };

  const getBasementHeightFt = (): number => {
    if (basementHeight !== undefined && basementHeight > 0) return basementHeight / scale;
    return 8;
  };

  const PLINTH_H = getPlinthHeightFt() * scale;
  const BASEMENT_H = getBasementHeightFt() * scale;
  const WALL_THICKNESS = getWallThicknessFt() * scale;
  const PLINTH_OFFSET = 0.5 * scale;

  const bwHeight = 6 * scale;
  const bwThickness = (8 / 12) * scale;
  const frontMosPx = (frontMos || 0) * scale;
  const backMosPx = (backMos || 0) * scale;

  const sectionGroundStartX = frontMos > 0 ? (elevationStartX - frontMosPx) : elevationStartX;
  const sectionGroundEndX = backMos > 0 ? (elevationStartX + baseBuiltUpHeight + backMosPx) : (elevationStartX + baseBuiltUpHeight);

  const BALCONY_H = 1.2 * 3.28084 * scale;

  const planWidthFt = baseBuiltUpWidth / scale;
  const sectionX_plan = planWidthFt - sectionLineX;

  const getFloorRoomsList = (floorName: string): any[] => {
    const data = floorRooms?.[floorName] || {};
    if (Array.isArray(data)) return data;
    return Object.values(data);
  };

  const getFloorTopY = (floorIndex: number): number => {
    let y = 0;
    for (let i = 0; i < floorIndex; i++) {
      const fName = processedFloors[i];
      const fH = getFloorHeightFt(fName) * scale;
      const sH = getSlabThicknessFt(fName) * scale;
      y += fH + sH;
    }
    const fName = processedFloors[floorIndex];
    const fH = getFloorHeightFt(fName) * scale;
    const sH = getSlabThicknessFt(fName) * scale;
    return -(y + fH + sH);
  };

  // ============================================================
  // DOOR symbol
  // ============================================================
  const renderSectionDoor = (
    x: number, y: number, w: number, h: number, keyStr: string
  ) => {
    return (
      <g key={keyStr}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x}
          y1={y + h / 2}
          x2={x + w}
          y2={y + h / 2}
          stroke={LINE_COLOR}
          strokeWidth="0.4"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    );
  };

  // ============================================================
  // WINDOW symbol
  // ============================================================
  const renderSectionWindow = (
    x: number, y: number, w: number, h: number, keyStr: string
  ) => {
    return (
      <g key={keyStr}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        />
        <line x1={x + w * 0.25} y1={y} x2={x + w * 0.25} y2={y + h} stroke={LINE_COLOR} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        <line x1={x + w * 0.75} y1={y} x2={x + w * 0.75} y2={y + h} stroke={LINE_COLOR} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={LINE_COLOR} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      </g>
    );
  };

  // ============================================================
  // STAIRCASE symbol
  // ============================================================
  const renderSectionStaircase = (
    x: number, y: number, w: number, h: number, spec: any, keyStr: string
  ) => {
    const riserCount = Number(spec?.riserCount) || Number(spec?.staircaseSpec?.riserCount) || 17;
    const riserInches = Number(spec?.actualRiserInches) || Number(spec?.staircaseSpec?.actualRiserInches) || 7;

    const steps = Math.min(Math.max(riserCount, 6), 18);
    const stepW = w / steps;
    const stepH = h / steps;

    const stepPaths: React.ReactElement[] = [];
    for (let i = 0; i < steps; i++) {
      const sx = x + i * stepW;
      const sy = y + h - (i + 1) * stepH;
      stepPaths.push(
        <path
          key={`step-${i}`}
          d={`M ${sx} ${sy + stepH} L ${sx} ${sy} L ${sx + stepW} ${sy}`}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    return (
      <g key={keyStr}>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke={LINE_COLOR} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        {stepPaths}
        <line x1={x + w / 2} y1={y + h - 3} x2={x + w / 2} y2={y + 3} stroke={LINE_COLOR} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        <polygon points={`${x + w / 2},${y + 2} ${x + w / 2 - 1.5},${y + 5} ${x + w / 2 + 1.5},${y + 5}`} fill={LINE_COLOR} />
        {riserCount && h > 40 && (
          <text x={x + w / 2} y={y + h / 2} fill={LINE_COLOR} fontSize="3.5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            {riserCount} R @ {riserInches.toFixed(1)}"
          </text>
        )}
      </g>
    );
  };

  // ============================================================
  // SECTION ROOMS
  // ============================================================
  const renderSectionRoomsForFloor = (floorName: string, floorTopY: number, floorHeightPx: number): React.ReactNode => {
    const rooms = getFloorRoomsList(floorName);
    if (!rooms.length) return null;

    const intersectingRooms = rooms.filter((r: any) => {
      const rx = Number(r.x ?? 0);
      const rw = Number(r.w ?? 0);
      return sectionX_plan >= rx && sectionX_plan <= rx + rw;
    });

    if (!intersectingRooms.length) return null;

    const sorted = [...intersectingRooms].sort((a, b) => Number(a.y || 0) - Number(b.y || 0));

    return (
      <g key={`section-rooms-floor-${floorName}`}>
        {sorted.map((r: any, idx: number) => {
          const ry = Number(r.y ?? 0);
          const rh = Number(r.h ?? 0);
          const rw = Number(r.w ?? 0);
          const roomName = String(r.name || 'ROOM').toUpperCase();
          const isStair = roomName.includes('STAIR') || r.type === 'stairs';

          const sectionX = elevationStartX + ry * scale;
          const sectionW = rh * scale;
          const sectionY = floorTopY;
          const sectionH = floorHeightPx;

          const roomDoors = Array.isArray(r.doors) ? r.doors : [];
          const roomWindows = Array.isArray(r.windows) ? r.windows : [];
          const stairSpec = (r as any).embeddedStair || (r as any).staircaseSpec;

          return (
            <g key={`section-room-${floorName}-${idx}`}>
              <rect
                x={sectionX}
                y={sectionY}
                width={sectionW}
                height={sectionH}
                fill="none"
                stroke={LINE_COLOR}
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />

              {isStair && stairSpec && sectionW > 10 && (
                renderSectionStaircase(
                  sectionX + 2,
                  sectionY + 2,
                  sectionW - 4,
                  sectionH - 4,
                  stairSpec,
                  `stair-${floorName}-${idx}`
                )
              )}

              {roomDoors.map((d: any, dIdx: number) => {
                const dw = Math.max(1, Number(d.widthFeet || 3) * scale);
                const off = Math.max(0, Number(d.offsetFeet || 0) * scale);
                const doorHeightFt = Math.max(6, Number(d.heightFeet || 6.5));
                const doorH = Math.min(doorHeightFt * scale, sectionH);

                if (d.wall === 'TOP' || d.wall === 'BOTTOM') {
                  const maxX = Math.max(0, sectionW - dw);
                  const clampedOff = Math.min(off, maxX);
                  const doorX = sectionX + clampedOff;
                  const doorY = d.wall === 'TOP' ? sectionY : sectionY + sectionH - doorH;
                  return renderSectionDoor(doorX, doorY, dw, doorH, `door-${floorName}-${idx}-${dIdx}`);
                }

                if (d.wall === 'LEFT' || d.wall === 'RIGHT') {
                  const maxY = Math.max(0, sectionH - doorH);
                  const clampedOff = Math.min(off, maxY);
                  const doorY = sectionY + clampedOff;
                  const doorX = d.wall === 'LEFT' ? sectionX : sectionX + sectionW - dw;
                  return renderSectionDoor(doorX, doorY, dw, doorH, `door-${floorName}-${idx}-${dIdx}`);
                }

                return null;
              })}

              {roomWindows.map((w: any, wIdx: number) => {
                const ww = Math.max(1, Number(w.lengthFeet || 3) * scale);
                const off = Math.max(0, Number(w.offsetFeet || 0) * scale);
                const winHeightFt = Math.max(2, Number(w.heightFeet || 3));
                const winH = Math.min(winHeightFt * scale, sectionH);

                if (w.wall === 'TOP' || w.wall === 'BOTTOM') {
                  const maxX = Math.max(0, sectionW - ww);
                  const clampedOff = Math.min(off, maxX);
                  const winX = sectionX + clampedOff;
                  const winY = w.wall === 'TOP' ? sectionY : sectionY + sectionH - winH;
                  return renderSectionWindow(winX, winY, ww, winH, `win-${floorName}-${idx}-${wIdx}`);
                }

                if (w.wall === 'LEFT' || w.wall === 'RIGHT') {
                  const maxY = Math.max(0, sectionH - winH);
                  const clampedOff = Math.min(off, maxY);
                  const winY = sectionY + clampedOff;
                  const winX = w.wall === 'LEFT' ? sectionX : sectionX + sectionW - ww;
                  return renderSectionWindow(winX, winY, ww, winH, `win-${floorName}-${idx}-${wIdx}`);
                }

                return null;
              })}

              {sectionW > 15 && (
                <text
                  x={sectionX + sectionW / 2}
                  y={sectionY + sectionH / 2 - 5}
                  fill={LINE_COLOR}
                  fontSize="4"
                  fontWeight="normal"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {roomName.substring(0, 14)}
                </text>
              )}

              {sectionW > 25 && (
                <text
                  x={sectionX + sectionW / 2}
                  y={sectionY + sectionH / 2 + 4}
                  fill={LINE_COLOR}
                  fontSize="3.5"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {rh.toFixed(1)}'×{rw.toFixed(1)}'
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // ============================================================
  // DYNAMIC ARCHITECT-STYLE ELEVATION + SECTION (same rooms/doors/windows/stairs as the plans)
  // ============================================================
  const sectionCtx = React.useMemo(
    () => buildSectionContext(processedFloors, floorData, floorRooms, baseBuiltUpWidth / scale, baseBuiltUpHeight / scale),
    [processedFloors, floorData, floorRooms, baseBuiltUpWidth, baseBuiltUpHeight, scale]
  );
  const sectionCut: SectionCutDef = { id: "A", axis: "VERTICAL", positionFt: "AUTO", look: "LEFT" };

  return (
    <g>
      {/* ============================================================ */}
      {/* 1. FRONT ELEVATION                                          */}
      {/* ============================================================ */}
      <g className="elevation-view">
        <ElevationDrawing ctx={sectionCtx} side="FRONT" embedded={{ originX: elevationStartX, originY: 0, pxPerFt: scale }} />
      </g>

      {/* ============================================================ */}
      {/* 2. SECTION VIEW                                             */}
      {/* ============================================================ */}
      <g className="section-view" transform={`translate(${sectionStartX - elevationStartX}, 0)`}>
        <SectionDrawing ctx={sectionCtx} cut={sectionCut} embedded={{ originX: elevationStartX, originY: 0, pxPerFt: scale }} />

        {frontMos > 0 && (
          <g className="front-boundary-wall">
            <rect x={elevationStartX - frontMosPx} y={PLINTH_H - bwHeight} width={bwThickness} height={bwHeight} fill="url(#wallHatch)" stroke={LINE_COLOR} strokeWidth="0.5" />
            {renderHeightDim(elevationStartX - frontMosPx, PLINTH_H - bwHeight, PLINTH_H, formatDim(bwHeight, scale, measurementUnit), 'left', LINE_COLOR, scale)}
            <text x={elevationStartX - frontMosPx + 2} y={PLINTH_H - bwHeight - 3} fill={LINE_COLOR} fontSize="5.5" fontWeight="bold">
              FRONT BOUNDARY WALL ({formatDim(bwHeight, scale, measurementUnit)})
            </text>
          </g>
        )}

        {backMos > 0 && (
          <g className="back-boundary-wall">
            <rect x={elevationStartX + baseBuiltUpHeight + backMosPx - bwThickness} y={PLINTH_H - bwHeight} width={bwThickness} height={bwHeight} fill="url(#wallHatch)" stroke={LINE_COLOR} strokeWidth="0.5" />
            {renderHeightDim(elevationStartX + baseBuiltUpHeight + backMosPx, PLINTH_H - bwHeight, PLINTH_H, formatDim(bwHeight, scale, measurementUnit), 'right', LINE_COLOR, scale)}
            <text x={elevationStartX + baseBuiltUpHeight + backMosPx - bwThickness - 30} y={PLINTH_H - bwHeight - 3} fill={LINE_COLOR} fontSize="5.5" fontWeight="bold">
              REAR BOUNDARY WALL ({formatDim(bwHeight, scale, measurementUnit)})
            </text>
          </g>
        )}

        <line x1={sectionGroundStartX - 15} y1={PLINTH_H} x2={sectionGroundEndX + 15} y2={PLINTH_H} stroke={LINE_COLOR} strokeWidth="0.6" />
        {renderEarthSymbol(sectionGroundStartX - 15, sectionGroundStartX, PLINTH_H, scale)}
        {renderEarthSymbol(sectionGroundEndX, sectionGroundEndX + 15, PLINTH_H, scale)}

        {hasBasement && (
          <g>
            <rect x={elevationStartX} y={PLINTH_H} width={baseBuiltUpHeight} height={BASEMENT_H} stroke={LINE_COLOR} strokeWidth="0.5" fill="none" />
            <line x1={elevationStartX + WALL_THICKNESS} y1={PLINTH_H + BASEMENT_H - (3 * scale)} x2={elevationStartX + baseBuiltUpHeight - WALL_THICKNESS} y2={PLINTH_H + BASEMENT_H - (3 * scale)} stroke={LINE_COLOR} strokeWidth="0.4" strokeDasharray="2" />
          </g>
        )}
      </g>
    </g>
  );
}