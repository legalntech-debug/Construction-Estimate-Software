import React from "react";
import { formatDim } from "./CadDimUtils";
import CadFloorPlansView from "./CadFloorPlansView";
import CadElevationSectionView, { computeSectionLayout } from "./CadElevationSectionView";
import CadStructuralTable from "./CadStructuralTable";
import {
  SectionCutDef, ElevationSide, DEFAULT_SECTION_CUTS,
  buildSectionContext, resolveCutPositionFt,
} from "../engine/sectionEngine";
import { decideStairFace, stairFloorHeightFtFrom } from "../engine/stairFaceDecision";

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
  leftMos?: number;
  rightMos?: number;
  sectionCuts?: SectionCutDef[];
  elevationSides?: ElevationSide[];
}

// 🎨 LIGHT THEME COLORS (White background + Black lines)
const LINE_COLOR = "#000000";          // Primary line color (was #00aaff)
const LABEL_BG = "#ffffff";            // Label background (was #000000)
const LABEL_TEXT = "#000000";          // Label text (was #00aaff)
const HATCH_COLOR = "#999999";         // Wall hatch lines (was #666666)

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
  leftMos = 0,
  rightMos = 0,
  sectionCuts,
  elevationSides,
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

  // ---- STAIR: plan view jis face ko use karta hai wahi section bhi use kare (single source of truth) ----
  const stairFloorHeightFt = stairFloorHeightFtFrom(normalizedFloorData);
  const stairDecision = decideStairFace(processedFloors, normalizedFloorData as any, {}, stairFloorHeightFt);

  // ---- ek hi context se ELEVATION + SECTION + plan cut-lines (rooms/doors/windows/stairs plan se hi aate hain) ----
  const ctx = buildSectionContext(
    processedFloors,
    normalizedFloorData,
    floorRooms,
    baseBuiltUpWidth / scale,
    baseBuiltUpHeight / scale,
    { stairFace: stairDecision?.face ?? null, stairFloorHeightFt }
  );

  // ---- where the drawing row starts (aligned with the floor plans) ----
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
  const elevationRowStartY = topmostY + MANUAL_ELEV_Y_OFFSET;

  // ---- dynamic elevations + sections ----
  const cuts = sectionCuts ?? DEFAULT_SECTION_CUTS;
  const sides: ElevationSide[] = elevationSides && elevationSides.length > 0 ? elevationSides : ["FRONT"];
  const layout = computeSectionLayout(ctx, sides, cuts, scale, elevationStartX);
  const sectionMarkers = cuts.map((c) => ({ cut: c, posOuterFt: resolveCutPositionFt(c, ctx).posOuter }));

  const tableTotalWidth = baseBuiltUpWidth + 50 * scale;
  const dynamicTableXOffset = layout.totalWidthPx + 60 * scale;

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

  const lv0 = layout.levels.floors[0];
  const fmtFt = (ft: number) => formatDim(ft * scale, scale, measurementUnit);
  const tableItems = [
    { label: "FOUNDATION / FOOTING SIZE", val: footingSpec },
    { label: "COLUMN SIZE & SPACING", val: columnSpec },
    { label: "PLINTH & FLOOR BEAM SIZE", val: "9\" x 12\" (M20 Grade Concrete)" },
    { label: "EXTERNAL & INTERNAL WALL", val: "External: 4\" Thick | Internal Partition: 4\" Thick" },
    { label: "SLAB & PARAPET DETAILS", val: `Roof & Floor Slabs: ${fmtFt(lv0?.slabFt ?? 0.5)} Thick | Parapet: ${fmtFt(layout.levels.parapetTop - layout.levels.roofSlabTop)} Height` },
    { label: "PLINTH & FLOOR HEIGHTS", val: `Plinth: ${fmtFt(layout.levels.plinthFt)} Above GL | Floor-to-Floor: ${fmtFt(lv0?.heightFt ?? 10)}` },
  ];

  const tableHeaderH = 15 * scale;
  const tableRowH = 6.5 * scale;
  const tablePad = 4 * scale;
  const tableDynamicHeight = tableHeaderH + (tableItems.length * tableRowH) + tablePad;

  return (
    <g>
      <defs>
        <pattern id="wallHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={HATCH_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id="plinthBeamHatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={LINE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" />
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
        sectionMarkers={sectionMarkers}
      />

      <g transform={`translate(0, ${elevationRowStartY - 6 * scale})`}>
        <CadElevationSectionView
          layout={layout}
          scale={scale}
          measurementUnit={measurementUnit}
          hasBasement={hasBasement}
          basementFt={basementHeight !== undefined ? basementHeight / scale : 8}
          mos={{ front: frontMos || 0, back: backMos || 0, left: leftMos || 0, right: rightMos || 0 }}
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
