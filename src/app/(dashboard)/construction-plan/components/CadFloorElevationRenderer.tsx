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
  frontMos?: number;
  backMos?: number;
}

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
  frontMos = 10,
  backMos = 5,
}: CadFloorElevationRendererProps) {
  
  const MANUAL_ELEV_Y_OFFSET = -25 * scale; 
  const MANUAL_TABLE_X_OFFSET = 130 * scale; 
  const MANUAL_TABLE_Y_OFFSET = -55 * scale; 

  const MANUAL_TOWER_DIM_X_OFFSET = +14.5 * scale; 
  const MANUAL_TOWER_DIM_Y_OFFSET = -4 * scale; 

  const adjustedBuiltUpPoints = React.useMemo(() => {
    if (!builtUpPoints || builtUpPoints.length < 4) return builtUpPoints;
    return builtUpPoints;
  }, [builtUpPoints]);

  if (!adjustedBuiltUpPoints || adjustedBuiltUpPoints.length < 4) return null;

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
      if (upper.includes("SIXTH")) return 7;
      if (upper.includes("SEVENTH")) return 8;
      if (upper.includes("EIGHTH")) return 9;
      if (upper.includes("NINTH")) return 10;
      if (upper.includes("TENTH")) return 11;
      if (upper.includes("TOWER")) return 999;

      const match = upper.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10) + 1;
      }
      return 50;
    };

    return [...selectedFloors].sort((a, b) => getFloorRank(a) - getFloorRank(b));
  }, [selectedFloors, parsedTotalFloors]);

  const hasBasement = processedFloors.some(f => f.toUpperCase().includes("BASEMENT"));
  
  const aboveGroundFloors = React.useMemo(() => {
    return processedFloors.filter(f => !f.toUpperCase().includes("BASEMENT"));
  }, [processedFloors]);

  const hasTowerSelected = aboveGroundFloors.some(f => f.toUpperCase().includes("TOWER"));
  
  const mainBuildingFloors = aboveGroundFloors.filter(f => !f.toUpperCase().includes("TOWER"));
  const effectiveMainFloorsCount = mainBuildingFloors.length > 0 ? mainBuildingFloors.length : parsedTotalFloors;
  const FLOOR_H = 10 * scale; 

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

  const baseBuiltUpWidth = Math.abs(adjustedBuiltUpPoints[1].x - adjustedBuiltUpPoints[0].x);
  const baseBuiltUpHeight = Math.abs(adjustedBuiltUpPoints[3].y - adjustedBuiltUpPoints[0].y);
  const baseArea = Math.round((baseBuiltUpWidth / scale) * (baseBuiltUpHeight / scale));

  const interFloorGap = 15 * scale;
  const rowHeightGap = baseBuiltUpHeight + 25 * scale;

  const itemsPerRow = processedFloors.length > 6 ? 4 : 3;

  const plotWidthFeet = baseBuiltUpWidth / scale;
  const plotDepthFeet = baseBuiltUpHeight / scale;

  const widthColumnCount = Math.max(2, Math.round(plotWidthFeet / 10) + 1);
  const depthColumnCount = Math.max(2, Math.round(plotDepthFeet / 10) + 1);

  const SLAB_H = 0.5 * scale;       
  const PLINTH_H = 1.5 * scale;   
  const BASEMENT_H = basementHeight !== undefined ? basementHeight : 8 * scale;    
  const WALL_THICKNESS = (8 / 12) * scale; 
  const FOOTING_DEPTH = 3.5 * scale; 

  const getFloorPoints = (floorName: string) => {
    const isTowerFloor = floorName.toUpperCase().includes("TOWER");
    if (isTowerFloor) {
      return adjustedBuiltUpPoints;
    }

    const floorInfo = floorData && floorData[floorName];
    const targetWidth = floorInfo?.width ? floorInfo.width * scale : null;
    const targetLength = floorInfo?.length ? floorInfo.length * scale : null;
    
    const rawArea = floorBuiltUpAreas && floorBuiltUpAreas[floorName];
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

  const renderRightFloorLabels = (startX: number, width: number) => {
    const extX = startX + width + 10 * scale;
    const boxW = 95;
    const boxH = 15;

    let accumulatedHeight = 0;
    const totalRenderedLevels = effectiveMainFloorsCount + (hasTowerSelected ? 2 : 1);
    
    const floorLabelsElements = Array.from({ length: totalRenderedLevels }).map((_, fIdx) => {
      const isParapet = fIdx === totalRenderedLevels - 1;
      const isTowerLevel = hasTowerSelected && fIdx === effectiveMainFloorsCount;
      const currentH = isParapet ? 3 * scale : (isTowerLevel ? 8 * scale : FLOOR_H);
      const floorTopY = - (accumulatedHeight + currentH + SLAB_H);
      const slabMidY = floorTopY + SLAB_H / 2;
      accumulatedHeight += currentH + SLAB_H;
      const floorLabel = processedFloors[fIdx] || `FLOOR ${fIdx + 1}`;
      const slabThicknessLabel = isParapet ? "3'-0\" Parapet" : formatDim(SLAB_H, scale, measurementUnit);

      return (
        <g key={fIdx}>
          <line x1={startX + width} y1={slabMidY} x2={extX} y2={slabMidY} stroke="#00aaff" strokeWidth="0.5" strokeDasharray="2" />
          <circle cx={startX + width} cy={slabMidY} r={1.2} fill="#00aaff" />
          <rect x={extX} y={slabMidY - boxH / 2} width={boxW} height={boxH} fill="#000000" fillOpacity="0.92" stroke="#00aaff" strokeWidth="0.5" rx="2" />
          <text x={extX + boxW / 2} y={slabMidY} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            {isParapet ? `PARAPET (${formatDim(3 * scale, scale, measurementUnit)})` : `${floorLabel} (${slabThicknessLabel})`}
          </text>
        </g>
      );
    });

    const plinthSlabMidY = PLINTH_H / 2;
    const plinthLabelElement = (
      <g key="plinth-slab-label">
        <line x1={startX + width} y1={plinthSlabMidY} x2={extX} y2={plinthSlabMidY} stroke="#00aaff" strokeWidth="0.5" strokeDasharray="2" />
        <circle cx={startX + width} cy={plinthSlabMidY} r={1.2} fill="#00aaff" />
        <rect x={extX} y={plinthSlabMidY - boxH / 2} width={boxW} height={boxH} fill="#000000" fillOpacity="0.92" stroke="#00aaff" strokeWidth="0.5" rx="2" />
        <text x={extX + boxW / 2} y={plinthSlabMidY} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
          PLINTH HEIGHT ({formatDim(PLINTH_H, scale, measurementUnit)})
        </text>
      </g>
    );

    return [...floorLabelsElements, plinthLabelElement];
  };

  const renderBuildingStructure = (startX: number, totalWidth: number, colCount: number, isSection: boolean, showDims: boolean) => {
    const BEAM_D = (10 / 12) * scale;
    const COL_W = WALL_THICKNESS;
    
    const colBottom = hasBasement ? PLINTH_H + BASEMENT_H + FOOTING_DEPTH : PLINTH_H + FOOTING_DEPTH;
    
    const elements: React.ReactElement[] = [];

    let roofTopY = 0;
    let tempY = SLAB_H;
    for (let i = 0; i < effectiveMainFloorsCount; i++) {
      tempY += FLOOR_H + SLAB_H;
    }
    roofTopY = -tempY;

    Array.from({ length: colCount }).forEach((_, cIdx) => {
      const ratio = cIdx / (colCount - 1);
      const colX = startX + ratio * (totalWidth - COL_W);
      const colTop = roofTopY + SLAB_H; 
      
      if (!isSection) {
        // 1. Sub-structure column (solid)
        elements.push(
          <rect
            key={`col-${cIdx}-sub`}
            x={colX}
            y={0}
            width={COL_W}
            height={colBottom - 1.2 * scale}
            fill="none"
            stroke="#00aaff"
            strokeWidth="0.5"
          />
        );

        // 2. Ground floor column segment (solid)
        elements.push(
          <rect
            key={`col-${cIdx}-ground`}
            x={colX}
            y={-(FLOOR_H + SLAB_H)}
            width={COL_W}
            height={FLOOR_H + SLAB_H}
            fill="none"
            stroke="#00aaff"
            strokeWidth="0.5"
          />
        );

        // 3. First Floor column segment (solid, no hidden lines)
        elements.push(
          <rect
            key={`col-${cIdx}-f1`}
            x={colX}
            y={-2 * (FLOOR_H + SLAB_H)}
            width={COL_W}
            height={FLOOR_H + SLAB_H}
            fill="none"
            stroke="#00aaff"
            strokeWidth="0.5"
          />
        );

        // 4. Upper floors column segment (solid) above 1st floor
        const upperTop = roofTopY + SLAB_H;
        const firstFloorTopY = -2 * (FLOOR_H + SLAB_H);
        if (upperTop < firstFloorTopY) {
          elements.push(
            <rect
              key={`col-${cIdx}-upper`}
              x={colX}
              y={upperTop}
              width={COL_W}
              height={Math.abs(upperTop - firstFloorTopY)}
              fill="none"
              stroke="#00aaff"
              strokeWidth="0.5"
            />
          );
        }
      } else {
        elements.push(
          <rect
            key={`col-${cIdx}`}
            x={colX}
            y={colTop}
            width={COL_W}
            height={colBottom - colTop - 1.2 * scale}
            fill="none"
            stroke="#00aaff"
            strokeWidth="0.5"
          />
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
        <rect
          key={`pcc-${cIdx}`}
          x={x1 - 0.3 * scale}
          y={padBottomY}
          width={baseW + 0.6 * scale}
          height={0.5 * scale}
          fill="none"
          stroke="#00aaff"
          strokeWidth="0.4"
        />
      );

      elements.push(
        <polygon
          key={`footing-pad-${cIdx}`}
          points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
          fill="none"
          stroke="#00aaff"
          strokeWidth="0.5"
        />
      );
    });

    const showTower = hasTowerSelected && isSection;

    let towerRoofY = roofTopY;
    let towerWidth = 10 * scale;
    const mainAreaCenter = startX + (totalWidth / 2);
    let towerStartX = mainAreaCenter - (towerWidth / 2);
    
    const towerFloorName = processedFloors.find(f => f.toUpperCase().includes("TOWER")) || "TOWER";
    const towerInfo = floorData && floorData[towerFloorName];
    if (towerInfo) {
      if (towerInfo.length) towerWidth = towerInfo.length * scale; 
      if (towerInfo.y !== undefined) {
        towerStartX = (startX + totalWidth) - (towerInfo.y * scale) - towerWidth;
      }
    }

    if (showTower) {
      const towerH = 8 * scale;
      towerRoofY = roofTopY - towerH - SLAB_H;

      Array.from({ length: colCount }).forEach((_, cIdx) => {
        const ratio = cIdx / (colCount - 1);
        const colX = startX + ratio * (totalWidth - COL_W);
        if (colX >= towerStartX - COL_W && colX <= towerStartX + towerWidth) {
          elements.push(
            <rect
              key={`col-tower-${cIdx}`}
              x={colX}
              y={towerRoofY + SLAB_H}
              width={COL_W}
              height={towerH}
              fill="none"
              stroke="#00aaff"
              strokeWidth="0.5"
            />
          );
        }
      });
    }

    // Plinth Beams (Single bottom line)
    Array.from({ length: colCount - 1 }).forEach((_, cIdx) => {
      const ratio1 = cIdx / (colCount - 1);
      const ratio2 = (cIdx + 1) / (colCount - 1);
      const spanStart = startX + ratio1 * (totalWidth - COL_W) + COL_W;
      const spanWidth = (startX + ratio2 * (totalWidth - COL_W)) - spanStart;

      elements.push(
        <line
          key={`pb-${cIdx}`}
          x1={spanStart}
          y1={BEAM_D}
          x2={spanStart + spanWidth}
          y2={BEAM_D}
          stroke="#00aaff"
          strokeWidth="0.5"
        />
      );

      const brickH = PLINTH_H - BEAM_D;
      if (brickH > 0) {
        elements.push(
          <rect
            key={`pw-${cIdx}`}
            x={spanStart}
            y={BEAM_D}
            width={spanWidth}
            height={brickH}
            fill="url(#wallHatch)"
            stroke="#00aaff"
            strokeWidth="0.4"
          />
        );
      }
    });

    let currentY = 0;
    
    elements.push(
      <line
        key="plinth-slab"
        x1={startX}
        y1={0}
        x2={startX + totalWidth}
        y2={0}
        stroke="#00aaff"
        strokeWidth="0.6"
      />
    );
    currentY += SLAB_H;

    if (showDims) {
      elements.push(
        <g key="dim-plinth">
          {renderHeightDim(startX, 0, PLINTH_H, formatDim(PLINTH_H, scale, measurementUnit), 'left', '#00aaff', scale)}
        </g>
      );
    }

    Array.from({ length: effectiveMainFloorsCount }).forEach((_, fIdx) => {
      const floorTopY = -(currentY + FLOOR_H + SLAB_H);
      currentY += FLOOR_H + SLAB_H;

      const floorName = mainBuildingFloors[fIdx] || processedFloors[fIdx] || `FLOOR ${fIdx + 1}`;
      const fPoints = getFloorPoints(floorName);
      
      const floorSpanWidth = isSection 
        ? Math.abs(fPoints[3].y - fPoints[0].y) 
        : Math.abs(fPoints[1].x - fPoints[0].x);

      const fInfo = floorData && floorData[floorName];
      let floorXOffset = startX;
      
      if (isSection) {
        const floorOffset = fInfo?.y !== undefined ? fInfo.y * scale : 0;
        floorXOffset = (startX + totalWidth) - floorOffset - floorSpanWidth;
      } else {
        const floorOffset = fInfo?.x !== undefined ? fInfo.x * scale : 0;
        floorXOffset = mainAreaCenter - (floorSpanWidth / 2) + floorOffset;
      }

      if (showDims && !isSection) {
        elements.push(
          <g key={`dim-fl-${fIdx}`}>
            {renderHeightDim(startX, floorTopY + SLAB_H, floorTopY + FLOOR_H + SLAB_H, formatDim(FLOOR_H, scale, measurementUnit), 'left', '#00aaff', scale)}
          </g>
        );
      }

      elements.push(
        <line
          key={`slab-${fIdx}`}
          x1={floorXOffset}
          y1={floorTopY}
          x2={floorXOffset + floorSpanWidth}
          y2={floorTopY}
          stroke="#00aaff"
          strokeWidth="0.6"
        />
      );

      // Floor Beams (Single bottom line)
      Array.from({ length: colCount - 1 }).forEach((_, cIdx) => {
        const ratio1 = cIdx / (colCount - 1);
        const ratio2 = (cIdx + 1) / (colCount - 1);
        const spanStart = floorXOffset + ratio1 * (floorSpanWidth - COL_W) + COL_W;
        const spanWidth = (floorXOffset + ratio2 * (floorSpanWidth - COL_W)) - spanStart;

        const hangH = BEAM_D - SLAB_H;
        if (hangH > 0 && spanWidth > 0) {
          elements.push(
            <line
              key={`fb-${fIdx}-${cIdx}`}
              x1={spanStart}
              y1={floorTopY + BEAM_D}
              x2={spanStart + spanWidth}
              y2={floorTopY + BEAM_D}
              stroke="#00aaff"
              strokeWidth="0.5"
            />
          );
        }
      });
    });

    const parapetH = 3 * scale;
    if (showTower) {
      const overhang = 3 * scale;
      const extendedTowerX = towerStartX - overhang;
      const extendedTowerW = towerWidth + (2 * overhang);

      elements.push(
        <line
          key="tower-roof-slab"
          x1={extendedTowerX}
          y1={towerRoofY}
          x2={extendedTowerX + extendedTowerW}
          y2={towerRoofY}
          stroke="#00aaff"
          strokeWidth="0.6"
        />
      );

      elements.push(
        <rect
          key="tower-parapet"
          x={extendedTowerX}
          y={roofTopY - parapetH}
          width={extendedTowerW}
          height={parapetH}
          fill="none"
          stroke="#00aaff"
          strokeWidth="0.4"
        />
      );
    } else {
      elements.push(
        <rect
          key="standard-parapet"
          x={startX}
          y={roofTopY - parapetH}
          width={totalWidth}
          height={parapetH}
          fill="none"
          stroke="#00aaff"
          strokeWidth="0.4"
        />
      );
    }

    return <g>{elements}</g>;
  };

  let elevationHeight = 0;
  Array.from({ length: effectiveMainFloorsCount }).forEach(() => {
    elevationHeight += FLOOR_H + SLAB_H;
  });
  elevationHeight += (3 * scale);

  let sectionHeight = 0;
  Array.from({ length: effectiveMainFloorsCount }).forEach(() => {
    sectionHeight += FLOOR_H + SLAB_H;
  });
  if (hasTowerSelected) {
    sectionHeight += (8 * scale) + SLAB_H + (3 * scale);
  } else {
    sectionHeight += (3 * scale);
  }

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
    { label: "SLAB & PARAPET DETAILS", val: `Roof & Floor Slabs: ${formatDim(SLAB_H, scale, measurementUnit)} Thick | Parapet: 3'-0\" Height` },
    { label: "PLINTH & FLOOR HEIGHTS", val: `Plinth: 1'-6\" Above GL | Floor-to-Floor: ${formatDim(FLOOR_H, scale, measurementUnit)}` },
  ];

  const tableHeaderH = 15 * scale; 
  const tableRowH = 6.5 * scale;   
  const tablePad = 4 * scale;
  const tableDynamicHeight = tableHeaderH + (tableItems.length * tableRowH) + tablePad;

  return (
    <g>
      <defs>
        <pattern id="wallHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#666666" strokeWidth="0.6" />
        </pattern>
        <pattern id="plinthBeamHatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#00aaff" strokeWidth="0.4" />
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
        floorBuiltUpAreas={floorBuiltUpAreas}
        baseArea={baseArea}
        floorData={floorData}
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
          floorData={floorData}
          hasBasement={hasBasement}
          basementHeight={basementHeight}
          frontMos={frontMos}
          backMos={backMos}
          widthColumnCount={widthColumnCount}
          depthColumnCount={depthColumnCount}
          effectiveMainFloorsCount={effectiveMainFloorsCount}
          hasTowerSelected={hasTowerSelected}
          measurementUnit={measurementUnit}
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
        MANUAL_TABLE_X_OFFSET={MANUAL_TABLE_X_OFFSET}
        MANUAL_TABLE_Y_OFFSET={MANUAL_TABLE_Y_OFFSET}
      />
    </g>
  );
}