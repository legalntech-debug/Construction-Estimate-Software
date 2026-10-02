import React from "react";
import { formatDim, renderHeightDim } from "./CadDimUtils";
import CadFloorPlansView from "./CadFloorPlansView";
import CadElevationSectionView from "./CadElevationSectionView";
import CadStructuralTable from "./CadStructuralTable";

interface FloorDetail {
  length: number;
  width: number;
  area: number;
  x?: number;
  y?: number;
  hasBalcony?: boolean;
  gateOffsetX?: number;
  gateWidth?: number;
  gateHeight?: number;
  autoRooms?: string[];
}

interface CadFloorElevationRendererProps {
  totalFloors: number;
  builtUpPoints: { x: number; y: number }[];
  scale: number;
  selectedFloors?: string[];
  roadWidth?: number | string;
  roadFacingOption?: string;
  measurementUnit?: "FEET" | "METERS";
  basementHeight?: number;
  floorBuiltUpAreas?: { [key: string]: number };
  floorData?: Record<string, FloorDetail>;
  floorRooms?: Record<string, any>;
  frontMos?: number;
  backMos?: number;
}

// Helper to strip extra descriptions like "(KITCHEN & LIVING)" for robust lookup matching
const normalizeFloorKey = (name: string) => {
  return name.split("(")[0].trim().toUpperCase();
};

export default function CadFloorElevationRenderer({
  totalFloors,
  builtUpPoints,
  scale,
  selectedFloors = [],
  roadWidth = 20,
  roadFacingOption = "1 SIDE ROAD (SOUTH)",
  measurementUnit = "FEET",
  basementHeight,
  floorBuiltUpAreas = {},
  floorData = {},
  floorRooms = {},
  frontMos = 10,
  backMos = 5,
}: CadFloorElevationRendererProps) {

  const MANUAL_ELEV_Y_OFFSET = -25 * scale;
  const MANUAL_TABLE_Y_OFFSET = -55 * scale;

  const MANUAL_TOWER_DIM_X_OFFSET = +14.5 * scale;
  const MANUAL_TOWER_DIM_Y_OFFSET = -4 * scale;

  const adjustedBuiltUpPoints = React.useMemo(() => {
    if (!builtUpPoints || builtUpPoints.length < 4) return builtUpPoints;
    return builtUpPoints.map(p => ({
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
    }));
  }, [builtUpPoints]);

  const baseBuiltUpWidth = Math.abs((adjustedBuiltUpPoints?.[1]?.x || 0) - (adjustedBuiltUpPoints?.[0]?.x || 0));
  const baseBuiltUpHeight = Math.abs((adjustedBuiltUpPoints?.[3]?.y || 0) - (adjustedBuiltUpPoints?.[0]?.y || 0));

  // --- Robust Floor Data & Area Matcher ---
  const getFloorDataItem = React.useCallback((floorName: string) => {
    if (!floorData) return undefined;
    const targetKey = normalizeFloorKey(floorName);
    const match = Object.keys(floorData).find(
      (k) => normalizeFloorKey(k) === targetKey || k.trim().toUpperCase() === floorName.trim().toUpperCase()
    );
    return match ? floorData[match] : undefined;
  }, [floorData]);

  const getFloorAreaItem = React.useCallback((floorName: string) => {
    if (!floorBuiltUpAreas) return undefined;
    const targetKey = normalizeFloorKey(floorName);
    const match = Object.keys(floorBuiltUpAreas).find(
      (k) => normalizeFloorKey(k) === targetKey || k.trim().toUpperCase() === floorName.trim().toUpperCase()
    );
    return match ? floorBuiltUpAreas[match] : undefined;
  }, [floorBuiltUpAreas]);

  // ✅ ACTUAL floor height helper
  const getFloorHeightFt = React.useCallback((floorName: string): number => {
    const fData: any = getFloorDataItem(floorName) || {};
    const v1 = Number(fData.floorToFloorHeightFeet);
    if (Number.isFinite(v1) && v1 > 0) return v1;
    const v2 = Number(fData.planningSettings?.floorToFloorHeightFeet);
    if (Number.isFinite(v2) && v2 > 0) return v2;
    const v3 = Number(fData.settings?.floorToFloorHeightFeet);
    if (Number.isFinite(v3) && v3 > 0) return v3;
    return 10;
  }, [getFloorDataItem]);

  const getSlabThicknessFt = React.useCallback((floorName: string): number => {
    const fData: any = getFloorDataItem(floorName) || {};
    const inchValue = Number(fData.slabThicknessInch);
    if (Number.isFinite(inchValue) && inchValue > 0) return inchValue / 12;
    const feetValue = Number(fData.slabThicknessFeet);
    if (Number.isFinite(feetValue) && feetValue > 0) return feetValue;
    return 0.5;
  }, [getFloorDataItem]);

  if (!adjustedBuiltUpPoints || adjustedBuiltUpPoints.length < 4 || baseBuiltUpWidth === 0 || baseBuiltUpHeight === 0) {
    return null;
  }

  const parsedTotalFloors = Number(totalFloors) || selectedFloors.length || 1;

  const processedFloors = React.useMemo(() => {
    if (!selectedFloors || selectedFloors.length === 0) {
      return Array.from({ length: parsedTotalFloors }, (_, i) => i === 0 ? "GROUND FLOOR" : `FLOOR ${i + 1}`);
    }

    const getFloorRank = (name: string) => {
      const upper = name.toUpperCase();
      if (upper.includes("BASEMENT")) return -1;
      if (upper.includes("GROUND")) return 1;
      if (upper.includes("FIRST")) return 2;
      if (upper.includes("SECOND")) return 3;
      if (upper.includes("THIRD")) return 4;
      if (upper.includes("FOURTH")) return 5;
      if (upper.includes("FIFTH")) return 6;
      if (upper.includes("TOWER")) return 999;

      const match = upper.match(/(\d+)/);
      return match ? parseInt(match[1], 10) + 1 : 50;
    };

    return [...selectedFloors].sort((a, b) => getFloorRank(a) - getFloorRank(b));
  }, [selectedFloors, parsedTotalFloors]);

  const normalizedFloorData = React.useMemo(() => {
    const result: Record<string, FloorDetail> = {};
    processedFloors.forEach((fName) => {
      const item = getFloorDataItem(fName);
      if (item) result[fName] = item;
    });
    return result;
  }, [processedFloors, getFloorDataItem]);

  const normalizedFloorAreas = React.useMemo(() => {
    const result: Record<string, number> = {};
    processedFloors.forEach((fName) => {
      const area = getFloorAreaItem(fName);
      if (area !== undefined) result[fName] = area;
    });
    return result;
  }, [processedFloors, getFloorAreaItem]);

  const hasBasement = processedFloors.some(f => f.toUpperCase().includes("BASEMENT"));

  const aboveGroundFloors = React.useMemo(() => {
    return processedFloors.filter(f => !f.toUpperCase().includes("BASEMENT"));
  }, [processedFloors]);

  const hasTowerSelected = aboveGroundFloors.some(f => f.toUpperCase().includes("TOWER"));
  const mainBuildingFloors = aboveGroundFloors.filter(f => !f.toUpperCase().includes("TOWER"));
  const effectiveMainFloorsCount = mainBuildingFloors.length > 0 ? mainBuildingFloors.length : parsedTotalFloors;

  const getFloorName = (index: number) => {
    if (processedFloors && processedFloors[index] && processedFloors[index].trim() !== "") {
      return processedFloors[index];
    }
    return `FLOOR ${index + 1}`;
  };

  const opt = (roadFacingOption || "").toUpperCase();
  const hasLeftRoad = opt.includes("4 SIDE") || opt.includes("3 SIDE") || opt.includes("WEST") || opt.includes("LEFT");
  const numericRoadWidth = Number(roadWidth) || 20;
  const baseGap = 60 * scale;
  const roadOffset = hasLeftRoad ? (numericRoadWidth * scale * 0.8) : 0;
  const plotGap = baseGap + roadOffset;

  const baseArea = Math.round((baseBuiltUpWidth / scale) * (baseBuiltUpHeight / scale));
  const interFloorGap = 15 * scale;
  const rowHeightGap = baseBuiltUpHeight + 25 * scale;
  const itemsPerRow = processedFloors.length > 6 ? 4 : 3;

  const plotWidthFeet = baseBuiltUpWidth / scale;
  const plotDepthFeet = baseBuiltUpHeight / scale;
  const widthColumnCount = Math.max(2, Math.round(plotWidthFeet / 10) + 1);
  const depthColumnCount = Math.max(2, Math.round(plotDepthFeet / 10) + 1);

  const PLINTH_H = 1.5 * scale;
  const BASEMENT_H = basementHeight !== undefined ? basementHeight : 8 * scale;
  const WALL_THICKNESS = (8 / 12) * scale;
  const FOOTING_DEPTH = 3.5 * scale;
  const PARAPET_H = 3 * scale;

  const getFloorPoints = (floorName: string) => {
    const isTowerFloor = floorName.toUpperCase().includes("TOWER");
    if (isTowerFloor) return adjustedBuiltUpPoints;

    const floorInfo = getFloorDataItem(floorName);
    const targetWidth = floorInfo?.width ? floorInfo.width * scale : null;
    const targetLength = floorInfo?.length ? floorInfo.length * scale : null;

    const rawArea = getFloorAreaItem(floorName);
    const targetArea = (rawArea !== undefined && rawArea > 0) ? Number(rawArea) : baseArea;

    const p0 = adjustedBuiltUpPoints[0];
    const p1 = adjustedBuiltUpPoints[1];
    const p3 = adjustedBuiltUpPoints[3];

    if (targetWidth && targetLength) {
      return [
        { x: p0.x, y: p0.y },
        { x: p0.x + targetWidth, y: p0.y },
        { x: p0.x + targetWidth, y: p0.y + targetLength },
        { x: p0.x, y: p0.y + targetLength },
      ];
    }

    if (!targetArea || targetArea <= 0 || baseArea <= 0) return adjustedBuiltUpPoints;

    const ratio = Math.sqrt(targetArea / baseArea);
    const currentW = (p1.x - p0.x) * ratio;
    const currentH = (p3.y - p0.y) * ratio;

    return [
      { x: p0.x, y: p0.y },
      { x: p0.x + currentW, y: p0.y },
      { x: p0.x + currentW, y: p0.y + currentH },
      { x: p0.x, y: p0.y + currentH },
    ];
  };

  // ============================================================
  // ✅ DYNAMIC TOWER POSITION — extract from floorRooms (exact plan position)
  // ============================================================
  const getTowerRoomData = React.useCallback(() => {
    const towerFloorName = processedFloors.find(f => f.toUpperCase().includes("TOWER")) || "TOWER";
    const towerRoomsMap = (floorRooms?.[towerFloorName] || {}) as Record<string, any>;

    const roomsArray = Array.isArray(towerRoomsMap)
      ? towerRoomsMap
      : Object.values(towerRoomsMap);

    if (roomsArray.length === 0) return null;

    // ✅ Priority 1: Exact "TOWER" name match
    let towerRoom = roomsArray.find((r: any) => {
      const name = String(r?.name || "").toUpperCase().trim();
      return name === "TOWER" || name === "MUMTY" || name === "TOWER BLOCK";
    });

    // ✅ Priority 2: Any room with "TOWER" but NOT "STAIR"
    if (!towerRoom) {
      towerRoom = roomsArray.find((r: any) => {
        const name = String(r?.name || "").toUpperCase();
        return name.includes("TOWER") && !name.includes("STAIR") && !name.includes("MUMTY-STAIR");
      });
    }

    // ✅ Priority 3: Fallback — biggest room in tower floor (excluding terrace)
    if (!towerRoom) {
      const candidates = roomsArray.filter((r: any) => {
        const name = String(r?.name || "").toUpperCase();
        return !name.includes("TERRACE") && !name.includes("STAIR");
      });
      if (candidates.length > 0) {
        towerRoom = [...candidates].sort((a: any, b: any) => {
          const aArea = Number(a.w || 0) * Number(a.h || 0);
          const bArea = Number(b.w || 0) * Number(b.h || 0);
          return bArea - aArea;
        })[0];
      }
    }

    if (!towerRoom) return null;

    return {
      x: Number(towerRoom.x ?? towerRoom.relX ?? 0),
      y: Number(towerRoom.y ?? towerRoom.relY ?? 0),
      w: Number(towerRoom.w ?? towerRoom.width ?? 10),
      h: Number(towerRoom.h ?? towerRoom.length ?? 10),
      name: String(towerRoom.name || "TOWER"),
    };
  }, [processedFloors, floorRooms]);

  // ============================================================
  // ✅ RENDER FLOOR LABELS (dynamic heights)
  // ============================================================
  const renderRightFloorLabels = (startX: number, width: number) => {
    const extX = startX + width + 10 * scale;
    const boxW = 95;
    const boxH = 15;

    let accumulatedHeight = 0;
    const totalRenderedLevels = effectiveMainFloorsCount + (hasTowerSelected ? 2 : 1);

    const floorLabelsElements = Array.from({ length: totalRenderedLevels }).map((_, fIdx) => {
      const isParapet = fIdx === totalRenderedLevels - 1;
      const isTowerLevel = hasTowerSelected && fIdx === effectiveMainFloorsCount;

      let currentH: number;
      if (isParapet) {
        currentH = PARAPET_H;
      } else if (isTowerLevel) {
        currentH = 8 * scale;
      } else {
        const fName = processedFloors[fIdx] || `FLOOR ${fIdx + 1}`;
        currentH = getFloorHeightFt(fName) * scale;
      }

      const slabMidY = -(accumulatedHeight + currentH + 0.5 * scale);
      accumulatedHeight += currentH + 0.5 * scale;

      const floorLabel = processedFloors[fIdx] || `FLOOR ${fIdx + 1}`;
      const slabThicknessLabel = isParapet ? "3'-0\" Parapet" : "0'-6\"";

      return (
        <g key={fIdx}>
          <line x1={startX + width} y1={slabMidY} x2={extX} y2={slabMidY} stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2" />
          <circle cx={startX + width} cy={slabMidY} r={1.5} fill="#00aaff" />
          <rect x={extX} y={slabMidY - boxH / 2} width={boxW} height={boxH} fill="#000000" fillOpacity="0.92" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" rx="2" />
          <text x={extX + boxW / 2} y={slabMidY} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            {isParapet ? `PARAPET (${formatDim(PARAPET_H, scale, measurementUnit)})` : `${floorLabel} (${slabThicknessLabel})`}
          </text>
        </g>
      );
    });

    const plinthSlabMidY = PLINTH_H / 2;
    const plinthLabelElement = (
      <g key="plinth-slab-label">
        <line x1={startX + width} y1={plinthSlabMidY} x2={extX} y2={plinthSlabMidY} stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2" />
        <circle cx={startX + width} cy={plinthSlabMidY} r={1.5} fill="#00aaff" />
        <rect x={extX} y={plinthSlabMidY - boxH / 2} width={boxW} height={boxH} fill="#000000" fillOpacity="0.92" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" rx="2" />
        <text x={extX + boxW / 2} y={plinthSlabMidY} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
          PLINTH HEIGHT ({formatDim(PLINTH_H, scale, measurementUnit)})
        </text>
      </g>
    );

    return [...floorLabelsElements, plinthLabelElement];
  };

  // ============================================================
  // ✅ BUILDING STRUCTURE
  // ============================================================
  const renderBuildingStructure = (startX: number, totalWidth: number, colCount: number, isSection: boolean, showDims: boolean) => {
    const BEAM_D = (10 / 12) * scale;
    const COL_W = WALL_THICKNESS;
    const colBottom = hasBasement ? PLINTH_H + BASEMENT_H + FOOTING_DEPTH : PLINTH_H + FOOTING_DEPTH;

    const elements: React.ReactElement[] = [];
    let roofTopY = 0;
    let tempY = 0.5 * scale;
    for (let i = 0; i < effectiveMainFloorsCount; i++) {
      const fName = mainBuildingFloors[i] || processedFloors[i] || `FLOOR ${i + 1}`;
      tempY += getFloorHeightFt(fName) * scale + getSlabThicknessFt(fName) * scale;
    }
    roofTopY = -tempY;

    // ============================================================
    // COLUMNS + FOOTINGS
    // ============================================================
    Array.from({ length: colCount }).forEach((_, cIdx) => {
      const ratio = cIdx / Math.max(1, colCount - 1);
      const colX = startX + ratio * (totalWidth - COL_W);
      const colTop = roofTopY + 0.5 * scale;

      if (!isSection) {
        elements.push(
          <rect key={`col-${cIdx}-sub`} x={colX} y={0} width={COL_W} height={colBottom - 1.2 * scale} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        );

        let currentColY = 0;
        Array.from({ length: effectiveMainFloorsCount }).forEach((_, fIdx) => {
          const fName = mainBuildingFloors[fIdx] || processedFloors[fIdx] || `FLOOR ${fIdx + 1}`;
          const fH = getFloorHeightFt(fName) * scale;
          const sH = getSlabThicknessFt(fName) * scale;
          const colTopY = -(currentColY + fH + sH);
          elements.push(
            <rect key={`col-${cIdx}-f${fIdx}`} x={colX} y={colTopY} width={COL_W} height={fH + sH} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          );
          currentColY += fH + sH;
        });
      } else {
        elements.push(
          <rect key={`col-${cIdx}`} x={colX} y={colTop} width={COL_W} height={colBottom - colTop - 1.2 * scale} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        );
      }

      const padTopY = colBottom - 1.2 * scale;
      const padBottomY = colBottom;
      const baseW = effectiveMainFloorsCount <= 3 ? 4 * scale : effectiveMainFloorsCount <= 7 ? 5 * scale : 6.5 * scale;
      const topW = COL_W * 1.6;
      const baseCenterX = colX + COL_W / 2;

      const x1 = baseCenterX - baseW / 2;
      const y1 = padBottomY;
      const x2 = baseCenterX + baseW / 2;
      const y2 = padBottomY;
      const x3 = baseCenterX + topW / 2;
      const y3 = padTopY;
      const x4 = baseCenterX - topW / 2;
      const y4 = padTopY;

      elements.push(
        <rect key={`pcc-${cIdx}`} x={x1 - 0.3 * scale} y={padBottomY} width={baseW + 0.6 * scale} height={0.5 * scale} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      );

      elements.push(
        <polygon key={`footing-pad-${cIdx}`} points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      );
    });

    // ============================================================
    // ✅ TOWER — DYNAMIC POSITION from plan view
    // ============================================================
    const showTower = hasTowerSelected && isSection;
    let towerRoofY = roofTopY;
    let towerWidth = 10 * scale;
    let towerStartX = startX + (totalWidth / 2) - (towerWidth / 2);

    // ✅ Extract EXACT tower position from floorRooms
    const towerRoomData = getTowerRoomData();

    if (towerRoomData && showTower) {
      // ✅ Tower width from plan view
      const planTowerWidthFt = towerRoomData.w;
      if (planTowerWidthFt > 0 && planTowerWidthFt * scale <= totalWidth) {
        towerWidth = planTowerWidthFt * scale;
      }

      if (isSection) {
        // ✅ SECTION VIEW: plan ka Y-axis → section ka X-axis (depth direction)
        // Plan y=0 (bottom/road) → section LEFT
        // Plan y=H (top/rear) → section RIGHT
        const planY = towerRoomData.y;
        const computedX = startX + (planY * scale);
        towerStartX = Math.max(startX, Math.min(computedX, startX + totalWidth - towerWidth));
      } else {
        // ✅ ELEVATION VIEW: plan ka X-axis → elevation ka X-axis (width direction)
        // Plan x=0 (left) → elevation LEFT
        // Plan x=W (right) → elevation RIGHT
        const planX = towerRoomData.x;
        const computedX = startX + (planX * scale);
        towerStartX = Math.max(startX, Math.min(computedX, startX + totalWidth - towerWidth));
      }

      if (typeof console !== 'undefined') {
        console.log('[TOWER POSITION DEBUG]', {
          floorType: isSection ? 'SECTION' : 'ELEVATION',
          towerRoomData,
          planX: towerRoomData.x,
          planY: towerRoomData.y,
          planW: towerRoomData.w,
          planH: towerRoomData.h,
          towerStartX,
          towerWidth,
          startX,
          totalWidth,
        });
      }
    }

    // ✅ Draw tower
    if (showTower && towerWidth > 0) {
      const towerH = 8 * scale;
      towerRoofY = roofTopY - towerH - 0.5 * scale;

      // Tower columns
      Array.from({ length: colCount }).forEach((_, cIdx) => {
        const ratio = cIdx / Math.max(1, colCount - 1);
        const colX = startX + ratio * (totalWidth - COL_W);
        if (colX >= towerStartX - COL_W && colX <= towerStartX + towerWidth) {
          elements.push(
            <rect key={`col-tower-${cIdx}`} x={colX} y={towerRoofY + 0.5 * scale} width={COL_W} height={towerH} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          );
        }
      });

      // Tower left wall
      elements.push(
        <line key="tower-left-wall-section" x1={towerStartX} y1={towerRoofY} x2={towerStartX} y2={roofTopY} stroke="#00aaff" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      );

      // Tower right wall
      elements.push(
        <line key="tower-right-wall-section" x1={towerStartX + towerWidth} y1={towerRoofY} x2={towerStartX + towerWidth} y2={roofTopY} stroke="#00aaff" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      );

      // Tower base slab line
      elements.push(
        <line key="tower-base-slab-section" x1={towerStartX} y1={roofTopY} x2={towerStartX + towerWidth} y2={roofTopY} stroke="#00aaff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      );

      // Tower roof slab line
      elements.push(
        <line key="tower-roof-slab-line-section" x1={towerStartX} y1={towerRoofY} x2={towerStartX + towerWidth} y2={towerRoofY} stroke="#00aaff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      );

      // TOWER label
      elements.push(
        <text key="tower-label-section" x={towerStartX + towerWidth / 2} y={towerRoofY - 6} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle">
          TOWER ({formatDim(towerWidth, scale, measurementUnit)} WIDE)
        </text>
      );
    }

    // ============================================================
    // PLINTH BEAM & WALLS
    // ============================================================
    Array.from({ length: colCount - 1 }).forEach((_, cIdx) => {
      const ratio1 = cIdx / Math.max(1, colCount - 1);
      const ratio2 = (cIdx + 1) / Math.max(1, colCount - 1);
      const spanStart = startX + ratio1 * (totalWidth - COL_W) + COL_W;
      const spanWidth = (startX + ratio2 * (totalWidth - COL_W)) - spanStart;

      elements.push(
        <line key={`pb-${cIdx}`} x1={spanStart} y1={BEAM_D} x2={spanStart + spanWidth} y2={BEAM_D} stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      );

      const brickH = PLINTH_H - BEAM_D;
      if (brickH > 0) {
        elements.push(
          <rect key={`pw-${cIdx}`} x={spanStart} y={BEAM_D} width={spanWidth} height={brickH} fill="url(#wallHatch)" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        );
      }
    });

    // ============================================================
    // PLINTH SLAB
    // ============================================================
    let currentY = 0;
    elements.push(
      <line key="plinth-slab" x1={startX} y1={0} x2={startX + totalWidth} y2={0} stroke="#00aaff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    );
    currentY += 0.5 * scale;

    if (showDims) {
      elements.push(
        <g key="dim-plinth">
          {renderHeightDim(startX, 0, PLINTH_H, formatDim(PLINTH_H, scale, measurementUnit), 'left', '#00aaff', scale)}
        </g>
      );
    }

    // ============================================================
    // FLOOR SLABS + BEAMS
    // ============================================================
    Array.from({ length: effectiveMainFloorsCount }).forEach((_, fIdx) => {
      const fName = mainBuildingFloors[fIdx] || processedFloors[fIdx] || `FLOOR ${fIdx + 1}`;
      const fH = getFloorHeightFt(fName) * scale;
      const sH = getSlabThicknessFt(fName) * scale;

      const floorTopY = -(currentY + fH + sH);
      currentY += fH + sH;

      const fPoints = getFloorPoints(fName);

      const floorSpanWidth = isSection
        ? Math.abs(fPoints[3].y - fPoints[0].y)
        : Math.abs(fPoints[1].x - fPoints[0].x);

      const fInfo = getFloorDataItem(fName);
      let floorXOffset = startX;

      if (isSection) {
        const floorOffset = fInfo?.y !== undefined ? fInfo.y * scale : 0;
        floorXOffset = (startX + totalWidth) - floorOffset - floorSpanWidth;
      } else {
        const floorOffset = fInfo?.x !== undefined ? fInfo.x * scale : 0;
        floorXOffset = startX + (totalWidth / 2) - (floorSpanWidth / 2) + floorOffset;
      }

      if (showDims && !isSection) {
        elements.push(
          <g key={`dim-fl-${fIdx}`}>
            {renderHeightDim(startX, floorTopY + sH, floorTopY + fH + sH, formatDim(fH, scale, measurementUnit), 'left', '#00aaff', scale)}
          </g>
        );
      }

      elements.push(
        <line key={`slab-${fIdx}`} x1={floorXOffset} y1={floorTopY} x2={floorXOffset + floorSpanWidth} y2={floorTopY} stroke="#00aaff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      );

      Array.from({ length: colCount - 1 }).forEach((_, cIdx) => {
        const ratio1 = cIdx / Math.max(1, colCount - 1);
        const ratio2 = (cIdx + 1) / Math.max(1, colCount - 1);
        const spanStart = floorXOffset + ratio1 * (floorSpanWidth - COL_W) + COL_W;
        const spanWidth = (floorXOffset + ratio2 * (floorSpanWidth - COL_W)) - spanStart;

        const hangH = BEAM_D - sH;
        if (hangH > 0 && spanWidth > 0) {
          elements.push(
            <line key={`fb-${fIdx}-${cIdx}`} x1={spanStart} y1={floorTopY + BEAM_D} x2={spanStart + spanWidth} y2={floorTopY + BEAM_D} stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          );
        }
      });
    });

    // ============================================================
    // PARAPET — tower ke area skip
    // ============================================================
    if (showTower && towerWidth > 0) {
      if (towerStartX > startX + 0.5) {
        elements.push(
          <rect key="parapet-left-of-tower-section" x={startX} y={roofTopY - PARAPET_H} width={towerStartX - startX} height={PARAPET_H} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        );
      }

      if (towerStartX + towerWidth < startX + totalWidth - 0.5) {
        elements.push(
          <rect key="parapet-right-of-tower-section" x={towerStartX + towerWidth} y={roofTopY - PARAPET_H} width={(startX + totalWidth) - (towerStartX + towerWidth)} height={PARAPET_H} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        );
      }
    } else {
      elements.push(
        <rect key="standard-parapet-section" x={startX} y={roofTopY - PARAPET_H} width={totalWidth} height={PARAPET_H} fill="none" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      );
    }

    return <g>{elements}</g>;
  };

  // ============================================================
  // ELEVATION / SECTION HEIGHTS
  // ============================================================
  let elevationHeight = 0;
  for (let i = 0; i < effectiveMainFloorsCount; i++) {
    const fName = mainBuildingFloors[i] || processedFloors[i] || `FLOOR ${i + 1}`;
    elevationHeight += getFloorHeightFt(fName) * scale + getSlabThicknessFt(fName) * scale;
  }
  elevationHeight += PARAPET_H;

  let sectionHeight = 0;
  for (let i = 0; i < effectiveMainFloorsCount; i++) {
    const fName = mainBuildingFloors[i] || processedFloors[i] || `FLOOR ${i + 1}`;
    sectionHeight += getFloorHeightFt(fName) * scale + getSlabThicknessFt(fName) * scale;
  }
  if (hasTowerSelected) {
    sectionHeight += (8 * scale) + 0.5 * scale + PARAPET_H;
  } else {
    sectionHeight += PARAPET_H;
  }

  // ============================================================
  // Compute layout shift
  // ============================================================
  let leftmostX = Infinity;
  let topmostY = Infinity;

  processedFloors.forEach((_, index) => {
    const rowIndex = Math.floor(index / itemsPerRow);
    const colIndex = rowIndex % 2 === 0
      ? (itemsPerRow - 1) - (index % itemsPerRow)
      : (index % itemsPerRow);

    const floorName = getFloorName(index);
    const currPoints = getFloorPoints(floorName);

    const shiftX = plotGap + (colIndex * (baseBuiltUpWidth + interFloorGap));
    const shiftY = rowIndex * rowHeightGap;

    const translatedPoints = currPoints.map((p) => ({
      x: p.x - shiftX,
      y: p.y - shiftY,
    }));

    const minX = Math.min(...translatedPoints.map(p => p.x));
    const minY = Math.min(...translatedPoints.map(p => p.y));

    if (minX < leftmostX) leftmostX = minX;
    if (minY < topmostY) topmostY = minY;
  });

  const elevationStartX = leftmostX;
  const sectionStartX = elevationStartX + baseBuiltUpWidth + 40 * scale;
  const elevationRowStartY = topmostY + MANUAL_ELEV_Y_OFFSET;

  const tableTotalWidth = baseBuiltUpWidth + 50 * scale;
  const dynamicTableXOffset = baseBuiltUpWidth + baseBuiltUpHeight + 70 * scale;

  const footingSpec = effectiveMainFloorsCount <= 3
    ? "4'-0\" x 4'-0\" (Sloped Isolated RCC Footing)"
    : effectiveMainFloorsCount <= 7
    ? "5'-0\" x 5'-0\" (Heavy Sloped Isolated Footing)"
    : "6'-6\" x 6'-6\" (Multi-Storey Isolated Footing)";

  const columnSpec = effectiveMainFloorsCount <= 3
    ? `9\" x 12\" @ 10'-0\" C/C (${widthColumnCount} Columns)`
    : effectiveMainFloorsCount <= 7
    ? `9\" x 15\" @ 10'-0\" C/C (${widthColumnCount} Columns)`
    : `12\" x 18\" @ 10'-0\" C/C (${widthColumnCount} Columns)`;

  const tableItems = [
    { label: "FOUNDATION / FOOTING SIZE", val: footingSpec },
    { label: "COLUMN SIZE & SPACING", val: columnSpec },
    { label: "PLINTH & FLOOR BEAM SIZE", val: "9\" x 12\" (M20 Grade Concrete)" },
    { label: "EXTERNAL & INTERNAL WALL", val: "External: 8\" Thick | Internal Partition: 4\" Thick" },
    { label: "SLAB & PARAPET DETAILS", val: `Roof & Floor Slabs: 0'-6\" Thick | Parapet: 3'-0\" Height` },
    { label: "PLINTH & FLOOR HEIGHTS", val: `Plinth: 1'-6\" Above GL | Floor-to-Floor: 10'-0\"` },
  ];

  const tableHeaderH = 15 * scale;
  const tableRowH = 6.5 * scale;
  const tablePad = 4 * scale;
  const tableDynamicHeight = tableHeaderH + (tableItems.length * tableRowH) + tablePad;

  return (
    <g>
      <defs>
        <pattern id="wallHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#666666" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id="plinthBeamHatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#00aaff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>

      <CadFloorPlansView
        processedFloors={processedFloors}
        itemsPerRow={itemsPerRow}
        plotGap={plotGap}
        baseBuiltUpWidth={baseBuiltUpWidth}
        interFloorGap={interFloorGap}
        rowHeightGap={rowHeightGap}
        scale={scale}
        getFloorPoints={getFloorPoints}
        floorBuiltUpAreas={normalizedFloorAreas}
        baseArea={baseArea}
        floorData={normalizedFloorData}
        roadOrientation={(roadFacingOption || "1 SIDE ROAD (SOUTH)").toUpperCase().includes("NORTH") ? "NORTH" :
          (roadFacingOption || "").toUpperCase().includes("EAST") ? "EAST" :
          (roadFacingOption || "").toUpperCase().includes("WEST") ? "WEST" : "SOUTH"}
        measurementUnit={measurementUnit}
        MANUAL_TOWER_DIM_X_OFFSET={MANUAL_TOWER_DIM_X_OFFSET}
        MANUAL_TOWER_DIM_Y_OFFSET={MANUAL_TOWER_DIM_Y_OFFSET}
      />

      <g transform={`translate(0, ${elevationRowStartY})`}>
        <CadElevationSectionView
          elevationStartX={elevationStartX}
          sectionStartX={sectionStartX}
          elevationHeight={elevationHeight}
          sectionHeight={sectionHeight}
          baseBuiltUpWidth={baseBuiltUpWidth}
          baseBuiltUpHeight={baseBuiltUpHeight}
          scale={scale}
          processedFloors={processedFloors}
          floorData={normalizedFloorData}
          hasBasement={hasBasement}
          basementHeight={basementHeight}
          frontMos={frontMos}
          backMos={backMos}
          widthColumnCount={widthColumnCount}
          depthColumnCount={depthColumnCount}
          effectiveMainFloorsCount={effectiveMainFloorsCount}
          hasTowerSelected={hasTowerSelected}
          measurementUnit={measurementUnit}
          sectionLineX={2}
          floorRooms={floorRooms}
          renderBuildingStructure={renderBuildingStructure}
          renderRightFloorLabels={renderRightFloorLabels}
        />
      </g>

      <CadStructuralTable
        tableTotalWidth={tableTotalWidth}
        tableDynamicHeight={tableDynamicHeight}
        tableItems={tableItems}
        scale={scale}
        elevationStartX={elevationStartX}
        elevationRowStartY={elevationRowStartY}
        MANUAL_TABLE_X_OFFSET={dynamicTableXOffset}
        MANUAL_TABLE_Y_OFFSET={MANUAL_TABLE_Y_OFFSET}
      />
    </g>
  );
}