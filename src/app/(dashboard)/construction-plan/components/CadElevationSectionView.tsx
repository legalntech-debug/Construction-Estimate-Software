import React from "react";
import { formatDim, renderTopWidthDim, renderHeightDim, renderEarthSymbol } from "./CadDimUtils";

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

  // Section line position (plan-local ft)
  const planWidthFt = baseBuiltUpWidth / scale;
  const sectionX_plan = planWidthFt - sectionLineX;

  // ============================================================
  // Helper: rooms list from floorRooms
  // ============================================================
  const getFloorRoomsList = (floorName: string): any[] => {
    const data = floorRooms?.[floorName] || {};
    if (Array.isArray(data)) return data;
    return Object.values(data);
  };

  // ============================================================
  // Compute floor top Y dynamically
  // ============================================================
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
  // DOOR symbol — SIMPLE RECTANGLE (no swing arc, no diagonal)
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
          stroke="#ffffff"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x}
          y1={y + h / 2}
          x2={x + w}
          y2={y + h / 2}
          stroke="#ffffff"
          strokeWidth="0.4"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    );
  };

  // ============================================================
  // WINDOW symbol — B&W architectural style
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
          stroke="#ffffff"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        />
        <line x1={x + w * 0.25} y1={y} x2={x + w * 0.25} y2={y + h} stroke="#ffffff" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        <line x1={x + w * 0.75} y1={y} x2={x + w * 0.75} y2={y + h} stroke="#ffffff" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#ffffff" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      </g>
    );
  };

  // ============================================================
  // STAIRCASE symbol — B&W zigzag from actual spec
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
          stroke="#ffffff"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    return (
      <g key={keyStr}>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke="#ffffff" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        {stepPaths}
        <line x1={x + w / 2} y1={y + h - 3} x2={x + w / 2} y2={y + 3} stroke="#ffffff" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        <polygon points={`${x + w / 2},${y + 2} ${x + w / 2 - 1.5},${y + 5} ${x + w / 2 + 1.5},${y + 5}`} fill="#ffffff" />
        {riserCount && h > 40 && (
          <text x={x + w / 2} y={y + h / 2} fill="#ffffff" fontSize="3.5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            {riserCount} R @ {riserInches.toFixed(1)}"
          </text>
        )}
      </g>
    );
  };

  // ============================================================
  // SECTION ROOMS — B&W, actual data
  // ============================================================
  const renderSectionRoomsForFloor = (floorName: string, floorTopY: number, floorHeightPx: number): React.ReactNode => {
    const rooms = getFloorRoomsList(floorName);
    if (!rooms.length) return null;

    // Filter rooms whose X-range covers section line
    const intersectingRooms = rooms.filter((r: any) => {
      const rx = Number(r.x ?? 0);
      const rw = Number(r.w ?? 0);
      return sectionX_plan >= rx && sectionX_plan <= rx + rw;
    });

    if (!intersectingRooms.length) return null;

    // Sort by plan-Y (depth direction)
    const sorted = [...intersectingRooms].sort((a, b) => Number(a.y || 0) - Number(b.y || 0));

    return (
      <g key={`section-rooms-floor-${floorName}`}>
        {sorted.map((r: any, idx: number) => {
          const ry = Number(r.y ?? 0);
          const rh = Number(r.h ?? 0);
          const rw = Number(r.w ?? 0);
          const roomName = String(r.name || 'ROOM').toUpperCase();
          const isStair = roomName.includes('STAIR') || r.type === 'stairs';

          // Room's plan-Y range → section X position
          const sectionX = elevationStartX + ry * scale;
          const sectionW = rh * scale;
          const sectionY = floorTopY;
          const sectionH = floorHeightPx;

          const roomDoors = Array.isArray(r.doors) ? r.doors : [];
          const roomWindows = Array.isArray(r.windows) ? r.windows : [];
          const stairSpec = (r as any).embeddedStair || (r as any).staircaseSpec;

          return (
            <g key={`section-room-${floorName}-${idx}`}>
              {/* Room outline — B&W */}
              <rect
                x={sectionX}
                y={sectionY}
                width={sectionW}
                height={sectionH}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />

              {/* Staircase inside stair room */}
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

              {/* DOORS — actual data, clamped to room bounds */}
              {roomDoors.map((d: any, dIdx: number) => {
                const dw = Math.max(1, Number(d.widthFeet || 3) * scale);
                const off = Math.max(0, Number(d.offsetFeet || 0) * scale);
                const doorHeightFt = Math.max(6, Number(d.heightFeet || 6.5));
                const doorH = Math.min(doorHeightFt * scale, sectionH);

                if (d.wall === 'TOP' || d.wall === 'BOTTOM') {
                  // Clamp door X within room
                  const maxX = Math.max(0, sectionW - dw);
                  const clampedOff = Math.min(off, maxX);
                  const doorX = sectionX + clampedOff;
                  const doorY = d.wall === 'TOP' ? sectionY : sectionY + sectionH - doorH;
                  return renderSectionDoor(doorX, doorY, dw, doorH, `door-${floorName}-${idx}-${dIdx}`);
                }

                if (d.wall === 'LEFT' || d.wall === 'RIGHT') {
                  // Clamp door Y within room
                  const maxY = Math.max(0, sectionH - doorH);
                  const clampedOff = Math.min(off, maxY);
                  const doorY = sectionY + clampedOff;
                  const doorX = d.wall === 'LEFT' ? sectionX : sectionX + sectionW - dw;
                  return renderSectionDoor(doorX, doorY, dw, doorH, `door-${floorName}-${idx}-${dIdx}`);
                }

                return null;
              })}

              {/* WINDOWS — actual data, clamped to room bounds */}
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

              {/* Room label — B&W */}
              {sectionW > 15 && (
                <text
                  x={sectionX + sectionW / 2}
                  y={sectionY + sectionH / 2 - 5}
                  fill="#ffffff"
                  fontSize="4"
                  fontWeight="normal"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {roomName.substring(0, 14)}
                </text>
              )}

              {/* Room dims — actual */}
              {sectionW > 25 && (
                <text
                  x={sectionX + sectionW / 2}
                  y={sectionY + sectionH / 2 + 4}
                  fill="#ffffff"
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

  return (
    <g>
      {/* ============================================================ */}
      {/* 1. FRONT ELEVATION                                          */}
      {/* ============================================================ */}
      <g className="elevation-view">
        {renderTopWidthDim(elevationStartX, baseBuiltUpWidth, -elevationHeight, formatDim(baseBuiltUpWidth, scale, measurementUnit), scale)}

        <rect x={elevationStartX} y={-elevationHeight} width={baseBuiltUpWidth} height={elevationHeight} stroke="#00aaff" strokeWidth="0.6" fill="none" />

        {renderBuildingStructure(elevationStartX, baseBuiltUpWidth, widthColumnCount, false, true)}

        {processedFloors.map((floor, index) => {
          const isGround = floor.toUpperCase().includes("GROUND");
          const fData = floorData[floor] || { width: baseBuiltUpWidth / scale, length: 30, area: 0, hasBalcony: !isGround };
          const FLOOR_H = getFloorHeightFt(floor) * scale;
          const SLAB_H = getSlabThicknessFt(floor) * scale;

          let accumulatedH = 0;
          for (let i = 0; i < index; i++) {
            accumulatedH += getFloorHeightFt(processedFloors[i]) * scale + getSlabThicknessFt(processedFloors[i]) * scale;
          }
          const floorTopY = -accumulatedH - FLOOR_H - SLAB_H;

          const hasBalcony = fData.hasBalcony !== undefined ? fData.hasBalcony : !isGround;
          const gateW = (fData.gateWidth || 4) * scale;
          const gateH = (fData.gateHeight || 6) * scale;
          const gateXOffset = elevationStartX + baseBuiltUpWidth / 2 + (fData.gateOffsetX !== undefined ? fData.gateOffsetX * scale : (-baseBuiltUpWidth / 2 + gateW / 2 + 10));

          const stairWidth = 4 * scale;
          const stairTreadCount = 3;

          return (
            <g key={`elev-features-${index}`}>
              {!isGround && hasBalcony && (
                <g transform={`translate(${elevationStartX}, ${floorTopY})`}>
                  <rect x={WALL_THICKNESS} y={FLOOR_H - BALCONY_H} width={baseBuiltUpWidth - (2 * WALL_THICKNESS)} height={BALCONY_H} fill="none" stroke="#059669" strokeWidth="0.8" />
                  <text x={baseBuiltUpWidth / 2} y={FLOOR_H - BALCONY_H / 2} fill="#059669" fontSize="5" fontWeight="800" textAnchor="middle" dominantBaseline="middle">
                    BALCONY (1.2M HEIGHT)
                  </text>
                </g>
              )}

              {isGround && (
                <g>
                  <rect x={gateXOffset - gateW / 2} y={-gateH} width={gateW} height={gateH} fill="none" stroke="#2563eb" strokeWidth="1" strokeDasharray="3 2" />
                  <text x={gateXOffset} y={-gateH / 2} fill="#2563eb" fontSize="5" fontWeight="800" textAnchor="middle" dominantBaseline="middle">
                    GATE ({(gateW / scale).toFixed(1)}&apos;×{(gateH / scale).toFixed(1)}&apos;)
                  </text>
                  <g transform={`translate(${gateXOffset}, 0)`}>
                    {Array.from({ length: stairTreadCount }).map((_, stepIdx) => {
                      const stepW = stairWidth - (stepIdx * (0.5 * scale));
                      const stepH = PLINTH_H / stairTreadCount;
                      const stepY = (stepIdx + 1) * stepH;
                      return (
                        <rect key={stepIdx} x={-stepW / 2} y={stepY - stepH} width={stepW} height={stepH} fill="#cbd5e1" stroke="#0f172a" strokeWidth="0.4" />
                      );
                    })}
                    <text x="0" y={PLINTH_H + 6} fill="#0f172a" fontSize="4" fontWeight="700" textAnchor="middle">
                      STAIRS (RISE 6&quot;, TREAD 1&apos;)
                    </text>
                  </g>
                </g>
              )}
            </g>
          );
        })}

        <line x1={elevationStartX - PLINTH_OFFSET - 25} y1={0} x2={elevationStartX + baseBuiltUpWidth + PLINTH_OFFSET + 25} y2={0} stroke="#00aaff" strokeWidth="0.6" strokeDasharray="4" />
        <text x={elevationStartX + baseBuiltUpWidth / 2 + 110} y={2} fill="#00aaff" fontSize="7.5" fontWeight="bold" textAnchor="middle">PLINTH LEVEL</text>

        <line x1={elevationStartX - 25} y1={PLINTH_H} x2={elevationStartX + baseBuiltUpWidth + 25} y2={PLINTH_H} stroke="#00aaff" strokeWidth="0.6" />
        {renderEarthSymbol(elevationStartX - 25, elevationStartX, PLINTH_H, scale)}
        {renderEarthSymbol(elevationStartX + baseBuiltUpWidth, elevationStartX + baseBuiltUpWidth + 25, PLINTH_H, scale)}

        <text x={elevationStartX + baseBuiltUpWidth / 2 + 130} y={PLINTH_H + 4} fill="#00aaff" fontSize="7.5" fontWeight="bold" textAnchor="middle">GROUND LEVEL</text>

        {hasBasement && (
          <g>
            <rect x={elevationStartX} y={PLINTH_H} width={baseBuiltUpWidth} height={BASEMENT_H} stroke="#00aaff" strokeWidth="0.5" fill="none" />
            {renderHeightDim(elevationStartX, PLINTH_H, PLINTH_H + BASEMENT_H, formatDim(BASEMENT_H, scale, measurementUnit), 'left', '#00aaff', scale)}
            <line x1={elevationStartX + WALL_THICKNESS} y1={PLINTH_H + BASEMENT_H - (3 * scale)} x2={elevationStartX + baseBuiltUpWidth - WALL_THICKNESS} y2={PLINTH_H + BASEMENT_H - (3 * scale)} stroke="#00aaff" strokeWidth="0.4" strokeDasharray="2" />
            <line x1={elevationStartX + baseBuiltUpWidth} y1={PLINTH_H + BASEMENT_H / 2} x2={elevationStartX + baseBuiltUpWidth + 6 * scale} y2={PLINTH_H + BASEMENT_H / 2} stroke="#00aaff" strokeWidth="0.5" strokeDasharray="2" />
            <rect x={elevationStartX + baseBuiltUpWidth + 6 * scale} y={PLINTH_H + BASEMENT_H / 2 - 7.5} width={95} height={15} fill="#000000" fillOpacity="0.92" stroke="#00aaff" strokeWidth="0.5" rx="2" />
            <text x={elevationStartX + baseBuiltUpWidth + 10 * scale + 35} y={PLINTH_H + BASEMENT_H / 2} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
              BASEMENT ({formatDim(BASEMENT_H, scale, measurementUnit)})
            </text>
          </g>
        )}

        <text x={elevationStartX + baseBuiltUpWidth / 2} y={PLINTH_H + (hasBasement ? BASEMENT_H : 0) + 45} fill="#00aaff" fontSize="10" fontWeight="bold" textAnchor="middle">FRONT ELEVATION</text>
      </g>

      {/* ============================================================ */}
      {/* 2. SECTION VIEW — B&W, actual data                          */}
      {/* ============================================================ */}
      <g className="section-view" transform={`translate(${sectionStartX - elevationStartX}, 0)`}>
        {renderTopWidthDim(elevationStartX, baseBuiltUpHeight, -sectionHeight, formatDim(baseBuiltUpHeight, scale, measurementUnit), scale)}

        <text x={elevationStartX + (baseBuiltUpHeight / 2)} y={PLINTH_H + (hasBasement ? BASEMENT_H : 0) + 45} fill="#00aaff" fontSize="10" fontWeight="bold" textAnchor="middle">
          SECTION VIEW (RIGHT SIDE FROM {sectionLineX} FT)
        </text>

        <rect x={elevationStartX} y={-sectionHeight} width={baseBuiltUpHeight} height={sectionHeight} stroke="#00aaff" strokeWidth="0.5" fill="none" />

        {renderBuildingStructure(elevationStartX, baseBuiltUpHeight, depthColumnCount, true, false)}

        {/* ACTUAL rooms in section */}
        {processedFloors.map((floor, floorIdx) => {
          const isTower = floor.toUpperCase().includes("TOWER");
          if (isTower) return null;

          const floorTopY = getFloorTopY(floorIdx);
          const floorH = getFloorHeightFt(floor) * scale;

          return (
            <g key={`section-rooms-wrapper-${floorIdx}`}>
              {renderSectionRoomsForFloor(floor, floorTopY, floorH)}
            </g>
          );
        })}

        {renderRightFloorLabels(elevationStartX, baseBuiltUpHeight)}

        {frontMos > 0 && (
          <g className="front-boundary-wall">
            <rect x={elevationStartX - frontMosPx} y={PLINTH_H - bwHeight} width={bwThickness} height={bwHeight} fill="url(#wallHatch)" stroke="#00aaff" strokeWidth="0.5" />
            {renderHeightDim(elevationStartX - frontMosPx, PLINTH_H - bwHeight, PLINTH_H, formatDim(bwHeight, scale, measurementUnit), 'left', '#00aaff', scale)}
            <text x={elevationStartX - frontMosPx + 2} y={PLINTH_H - bwHeight - 3} fill="#00aaff" fontSize="5.5" fontWeight="bold">
              FRONT BOUNDARY WALL ({formatDim(bwHeight, scale, measurementUnit)})
            </text>
          </g>
        )}

        {backMos > 0 && (
          <g className="back-boundary-wall">
            <rect x={elevationStartX + baseBuiltUpHeight + backMosPx - bwThickness} y={PLINTH_H - bwHeight} width={bwThickness} height={bwHeight} fill="url(#wallHatch)" stroke="#00aaff" strokeWidth="0.5" />
            {renderHeightDim(elevationStartX + baseBuiltUpHeight + backMosPx, PLINTH_H - bwHeight, PLINTH_H, formatDim(bwHeight, scale, measurementUnit), 'right', '#00aaff', scale)}
            <text x={elevationStartX + baseBuiltUpHeight + backMosPx - bwThickness - 30} y={PLINTH_H - bwHeight - 3} fill="#00aaff" fontSize="5.5" fontWeight="bold">
              REAR BOUNDARY WALL ({formatDim(bwHeight, scale, measurementUnit)})
            </text>
          </g>
        )}

        <line x1={elevationStartX} y1={0} x2={elevationStartX + baseBuiltUpHeight} y2={0} stroke="#00aaff" strokeWidth="0.6" strokeDasharray="4" />

        <line x1={sectionGroundStartX - 15} y1={PLINTH_H} x2={sectionGroundEndX + 15} y2={PLINTH_H} stroke="#00aaff" strokeWidth="0.6" />
        {renderEarthSymbol(sectionGroundStartX - 15, sectionGroundStartX, PLINTH_H, scale)}
        {renderEarthSymbol(sectionGroundEndX, sectionGroundEndX + 15, PLINTH_H, scale)}

        {hasBasement && (
          <g>
            <rect x={elevationStartX} y={PLINTH_H} width={baseBuiltUpHeight} height={BASEMENT_H} stroke="#00aaff" strokeWidth="0.5" fill="none" />
            <line x1={elevationStartX + WALL_THICKNESS} y1={PLINTH_H + BASEMENT_H - (3 * scale)} x2={elevationStartX + baseBuiltUpHeight - WALL_THICKNESS} y2={PLINTH_H + BASEMENT_H - (3 * scale)} stroke="#00aaff" strokeWidth="0.4" strokeDasharray="2" />
          </g>
        )}
      </g>
    </g>
  );
}