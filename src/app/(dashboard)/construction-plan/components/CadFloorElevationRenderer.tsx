import React from "react";

interface CadFloorElevationRendererProps {
  totalFloors: number;
  builtUpPoints: { x: number; y: number }[];
  scale: number;
  selectedFloors?: string[];
  roadWidth?: number | string;
  roadFacingOption?: string;
  measurementUnit?: "FEET" | "METERS";
  basementHeight?: number;
  floorBuiltUpAreas?: { [key: string]: number }; // 👉 Floor-wise built-up area support
  floorData?: Record<string, { length: number; width: number; area: number }>; // 👉 Add this
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
}: CadFloorElevationRendererProps) {
  
  // ==========================================
  // 🎛️ MANUAL POSITION CONTROLS
  // ==========================================
  const MANUAL_ELEV_Y_OFFSET = -25 * scale; 
  const MANUAL_TABLE_X_OFFSET = 130 * scale; 
  const MANUAL_TABLE_Y_OFFSET = -55 * scale; 

  const adjustedBuiltUpPoints = React.useMemo(() => {
    if (!builtUpPoints || builtUpPoints.length < 4) return builtUpPoints;
    return builtUpPoints;
  }, [builtUpPoints]);

  if (!adjustedBuiltUpPoints || adjustedBuiltUpPoints.length < 4) return null;

  const parsedTotalFloors = Number(totalFloors) || selectedFloors.length || 1;

  // Precise Floor Ranking
  const processedFloors = React.useMemo(() => {
    if (!selectedFloors || selectedFloors.length === 0) return [];

    const getFloorRank = (name: string) => {
      const upper = name.toUpperCase();
      if (upper.includes("TOWER")) return 999;
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

      const match = upper.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10) + 1;
      }
      return 50;
    };

    return [...selectedFloors].sort((a, b) => getFloorRank(a) - getFloorRank(b));
  }, [selectedFloors]);

  const hasBasement = processedFloors.some(f => f.toUpperCase().includes("BASEMENT"));
  
  const aboveGroundFloors = React.useMemo(() => {
    return processedFloors.filter(f => !f.toUpperCase().includes("BASEMENT"));
  }, [processedFloors]);

  const hasTowerSelected = aboveGroundFloors.some(f => f.toUpperCase().includes("TOWER"));
  const mainFloors = aboveGroundFloors.filter(f => !f.toUpperCase().includes("TOWER"));
  
  const effectiveMainFloorsCount = mainFloors.length > 0 ? mainFloors.length : parsedTotalFloors;
  const FLOOR_H = 10 * scale; 

  const getFloorName = (index: number, isElevation?: boolean) => {
    if (hasTowerSelected && isElevation && index === effectiveMainFloorsCount) {
      return "TOWER / MUMTY";
    }
    if (index === effectiveMainFloorsCount + (hasTowerSelected ? 1 : 0)) {
      return "PARAPET WALL";
    }
    if (aboveGroundFloors && aboveGroundFloors[index] && aboveGroundFloors[index].trim() !== "") {
      return aboveGroundFloors[index];
    }
    return `FLOOR ${index + 1}`;
  };

  const formatDim = (valPx: number) => {
    const valFeet = valPx / scale;
    if (measurementUnit === "METERS") {
      return `${(valFeet * 0.3048).toFixed(2)}m`;
    }
    const totalInches = Math.round(valFeet * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'-${inches}"`;
  };

  const opt = (roadFacingOption || "").toUpperCase();
  const hasLeftRoad = opt.includes("4 SIDE") || opt.includes("3 SIDE") || opt.includes("WEST") || opt.includes("LEFT");

  const numericRoadWidth = Number(roadWidth) || 20;
  const baseGap = 60 * scale; 
  const roadOffset = hasLeftRoad ? (numericRoadWidth * scale * 0.8) : 0;
  const plotGap = baseGap + roadOffset;

  const baseBuiltUpWidth = Math.abs(adjustedBuiltUpPoints[1].x - adjustedBuiltUpPoints[0].x);
  const baseBuiltUpHeight = Math.abs(adjustedBuiltUpPoints[3].y - adjustedBuiltUpPoints[0].y);
  const baseArea = (baseBuiltUpWidth / scale) * (baseBuiltUpHeight / scale);

  const interFloorGap = 15 * scale;
  const rowHeightGap = baseBuiltUpHeight + 25 * scale;

  const itemsPerRow = processedFloors.length > 6 ? 4 : 3;

  const plotWidthFeet = baseBuiltUpWidth / scale;
  const plotDepthFeet = baseBuiltUpHeight / scale;

  const widthColumnCount = Math.max(2, Math.round(plotWidthFeet / 10) + 1);
  const depthColumnCount = Math.max(2, Math.round(plotDepthFeet / 10) + 1);

  const SLAB_H = 0.5 * scale;       
  const PLINTH_H = 1.5 * scale;   
  const PLINTH_OFFSET = 0.5 * scale; 
  const BASEMENT_H = basementHeight !== undefined ? basementHeight : 8 * scale;    
  const WALL_THICKNESS = (8 / 12) * scale; 
  const FOOTING_DEPTH = 3.5 * scale; 

  // 👉 Helper to get scaled points for each floor based on user-entered Built-Up Area
  const getFloorPoints = (floorName: string) => {
  const floorInfo = floorData && floorData[floorName];
  const targetWidth = floorInfo?.width ? floorInfo.width * scale : null;
  const targetLength = floorInfo?.length ? floorInfo.length * scale : null;
  
  const targetArea = floorBuiltUpAreas && floorBuiltUpAreas[floorName] !== undefined 
    ? Number(floorBuiltUpAreas[floorName]) 
    : baseArea;

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

  const renderSideDim = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    centerPt: { x: number; y: number }
  ) => {
    const L = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    let perpX = -(p2.y - p1.y) / L;
    let perpY = (p2.x - p1.x) / L;
    const dx = midX - centerPt.x;
    const dy = midY - centerPt.y;
    if (perpX * dx + perpY * dy < 0) {
      perpX = -perpX;
      perpY = -perpY;
    }

    const dist = 14;
    const overshoot = 4;
    const boxHalfWidth = 24;

    const ext1_end = { x: p1.x + perpX * (dist + overshoot), y: p1.y + perpY * (dist + overshoot) };
    const ext2_end = { x: p2.x + perpX * (dist + overshoot), y: p2.y + perpY * (dist + overshoot) };

    return (
      <g>
        <line x1={p1.x} y1={p1.y} x2={ext1_end.x} y2={ext1_end.y} stroke="yellow" strokeWidth="0.4" strokeDasharray="2" />
        <line x1={p2.x} y1={p2.y} x2={ext2_end.x} y2={ext2_end.y} stroke="yellow" strokeWidth="0.4" strokeDasharray="2" />

        <g transform={`translate(${midX + perpX * dist}, ${midY + perpY * dist}) rotate(${angle})`}>
          <polygon points={`${-L / 2},0 ${-L / 2 + 5},-2.5 ${-L / 2 + 5},2.5`} fill="yellow" />
          <line x1={-L / 2} y1="0" x2={-boxHalfWidth} y2="0" stroke="yellow" strokeWidth="0.8" />
          <polygon points={`${L / 2},0 ${L / 2 - 5},-2.5 ${L / 2 - 5},2.5`} fill="yellow" />
          <line x1={boxHalfWidth} y1="0" x2={L / 2} y2="0" stroke="yellow" strokeWidth="0.8" />
          <text 
            x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="yellow" 
            style={{ fontSize: "9px", fontWeight: "bold", paintOrder: "stroke", stroke: "#000000", strokeWidth: "3px" }}
          >
            {formatDim(L)}
          </text>
        </g>
      </g>
    );
  };

  const renderTopWidthDim = (startX: number, width: number, yLevel: number, label: string) => {
    const dimY = yLevel - 2 * scale; 
    return (
      <g>
        <line x1={startX} y1={yLevel} x2={startX} y2={dimY - 4} stroke="#00aaff" strokeWidth="0.4" strokeDasharray="2" />
        <line x1={startX + width} y1={yLevel} x2={startX + width} y2={dimY - 4} stroke="#00aaff" strokeWidth="0.4" strokeDasharray="2" />
        <line x1={startX} y1={dimY} x2={startX + width} y2={dimY} stroke="#00aaff" strokeWidth="0.6" />
        <polygon points={`${startX},${dimY} ${startX + 4},${dimY - 2} ${startX + 4},${dimY + 2}`} fill="#00aaff" />
        <polygon points={`${startX + width},${dimY} ${startX + width - 4},${dimY - 2} ${startX + width - 4},${dimY + 2}`} fill="#00aaff" />
        <rect x={startX + width / 2 - 30} y={dimY - 8} width="64" height="16" fill="#000000" opacity="0.85" />
        <text x={startX + width / 2} y={dimY} fill="#00aaff" fontSize="7.5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      </g>
    );
  };

  const renderHeightDim = (x: number, yTop: number, yBottom: number, label: string) => {
    const midY = (yTop + yBottom) / 2;
    const dimX = x - 10 * scale; 
    const boxHeight = 16;
    return (
      <g>
        <line x1={x} y1={yTop} x2={dimX - 2} y2={yTop} stroke="#00aaff" strokeWidth="0.4" strokeDasharray="2" />
        <line x1={x} y1={yBottom} x2={dimX - 2} y2={yBottom} stroke="#00aaff" strokeWidth="0.4" strokeDasharray="2" />
        <line x1={dimX} y1={yTop} x2={dimX} y2={yBottom} stroke="#00aaff" strokeWidth="0.6" />
        <polygon points={`${dimX},${yTop} ${dimX - 2},${yTop + 4} ${dimX + 2},${yTop + 4}`} fill="#00aaff" />
        <polygon points={`${dimX},${yBottom} ${dimX - 2},${yBottom - 4} ${dimX + 2},${yBottom - 4}`} fill="#00aaff" />
        <g transform={`translate(${dimX}, ${midY}) rotate(-90)`}>
          <rect x={-boxHeight / 2} y="-15" width={boxHeight} height="30" fill="#000000" opacity="0.8" />
          <text x="0" y="2" textAnchor="middle" dominantBaseline="middle" fill="#00aaff" style={{ fontSize: "7.5px", fontWeight: "bold" }}>
            {label}
          </text>
        </g>
      </g>
    );
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
      const floorLabel = getFloorName(fIdx, true);
      const slabThicknessLabel = isParapet ? "3'-0\" Parapet" : formatDim(SLAB_H);

      return (
        <g key={fIdx}>
          <line x1={startX + width} y1={slabMidY} x2={extX} y2={slabMidY} stroke="#00aaff" strokeWidth="0.5" strokeDasharray="2" />
          <circle cx={startX + width} cy={slabMidY} r={1.2} fill="#00aaff" />
          <rect x={extX} y={slabMidY - boxH / 2} width={boxW} height={boxH} fill="#000000" fillOpacity="0.92" stroke="#00aaff" strokeWidth="0.5" rx="2" />
          <text x={extX + boxW / 2} y={slabMidY} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            {isParapet ? `PARAPET (${formatDim(3 * scale)})` : `${floorLabel} (${slabThicknessLabel})`}
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
          PLINTH HEIGHT ({formatDim(PLINTH_H)})
        </text>
      </g>
    );

    return [...floorLabelsElements, plinthLabelElement];
  };

  const renderEarthSymbol = (startX: number, endX: number, y: number) => {
    const step = 0.6 * scale; 
    const depth = 0.6 * scale; 
    let d = `M ${startX} ${y}`;
    let curX = startX;
    let down = true;
    while (curX < endX) {
      curX += step;
      d += ` L ${curX} ${y + (down ? depth : 0)}`;
      down = !down;
    }
    return <path d={d} stroke="#00aaff" strokeWidth="0.4" fill="none" />;
  };

  // 👉 Professional Trapezoidal / Sloped Isolated Footing & Column Renderer
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

    // 1. Main Columns & Proper Sloped/Trapezoidal Isolated Footings
    Array.from({ length: colCount }).forEach((_, cIdx) => {
      const ratio = cIdx / (colCount - 1);
      const colX = startX + ratio * (totalWidth - COL_W);
      const colTop = roofTopY + SLAB_H; 
      
      elements.push(
        <rect
          key={`col-${cIdx}`}
          x={colX}
          y={colTop}
          width={COL_W}
          height={colBottom - colTop - 1.2 * scale}
          fill="#002244"
          stroke="#00aaff"
          strokeWidth="0.5"
        />
      );

      // Trapezoidal / Sloped Isolated Footing Geometry
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

      // Bottom flat PCC Bedding layer
      elements.push(
        <rect
          key={`pcc-${cIdx}`}
          x={x1 - 0.3 * scale}
          y={padBottomY}
          width={baseW + 0.6 * scale}
          height={0.5 * scale}
          fill="#001122"
          stroke="#00aaff"
          strokeWidth="0.4"
        />
      );

      // Sloped RCC Isolated Footing Pad
      elements.push(
        <polygon
          key={`footing-pad-${cIdx}`}
          points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
          fill="#002244"
          stroke="#00aaff"
          strokeWidth="0.5"
        />
      );
    });

    const showTower = hasTowerSelected && isSection;

    // Tower Columns
    let towerRoofY = roofTopY;
    let towerWidth = 0;
    let towerStartX = 0;
    if (showTower) {
      towerWidth = Math.min(totalWidth, 10 * scale);
      towerStartX = startX + (totalWidth - towerWidth) / 2;
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
              fill="#002244"
              stroke="#00aaff"
              strokeWidth="0.5"
            />
          );
        }
      });
    }

    // 2. Plinth Beams & Ground Wall
    Array.from({ length: colCount - 1 }).forEach((_, cIdx) => {
      const ratio1 = cIdx / (colCount - 1);
      const ratio2 = (cIdx + 1) / (colCount - 1);
      const spanStart = startX + ratio1 * (totalWidth - COL_W) + COL_W;
      const spanWidth = (startX + ratio2 * (totalWidth - COL_W)) - spanStart;

      elements.push(
        <rect
          key={`pb-${cIdx}`}
          x={spanStart}
          y={0}
          width={spanWidth}
          height={BEAM_D}
          fill="#002244"
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

    // 3. Slabs & Floor Beams Layering
    let currentY = 0;
    
    // Plinth Slab
    elements.push(
      <rect
        key="plinth-slab"
        x={startX}
        y={-SLAB_H}
        width={totalWidth}
        height={SLAB_H}
        fill={isSection ? "#002244" : "#001122"}
        stroke="#00aaff"
        strokeWidth="0.5"
      />
    );
    currentY += SLAB_H;

    if (showDims) {
      elements.push(
        <g key="dim-plinth">
          {renderHeightDim(startX, 0, PLINTH_H, formatDim(PLINTH_H))}
        </g>
      );
    }

    // Main Floors Slabs & Beams
    Array.from({ length: effectiveMainFloorsCount }).forEach((_, fIdx) => {
      const floorTopY = -(currentY + FLOOR_H + SLAB_H);
      currentY += FLOOR_H + SLAB_H;

      if (showDims) {
        elements.push(
          <g key={`dim-fl-${fIdx}`}>
            {renderHeightDim(startX, floorTopY + SLAB_H, floorTopY + FLOOR_H + SLAB_H, formatDim(FLOOR_H))}
          </g>
        );
      }

      elements.push(
        <rect
          key={`slab-${fIdx}`}
          x={startX}
          y={floorTopY}
          width={totalWidth}
          height={SLAB_H}
          fill={isSection ? "#002244" : "#001122"}
          stroke="#00aaff"
          strokeWidth="0.5"
        />
      );

      Array.from({ length: colCount - 1 }).forEach((_, cIdx) => {
        const ratio1 = cIdx / (colCount - 1);
        const ratio2 = (cIdx + 1) / (colCount - 1);
        const spanStart = startX + ratio1 * (totalWidth - COL_W) + COL_W;
        const spanWidth = (startX + ratio2 * (totalWidth - COL_W)) - spanStart;

        const hangH = BEAM_D - SLAB_H;
        if (hangH > 0) {
          elements.push(
            <rect
              key={`fb-${fIdx}-${cIdx}`}
              x={spanStart}
              y={floorTopY + SLAB_H}
              width={spanWidth}
              height={hangH}
              fill="#002244"
              stroke="#00aaff"
              strokeWidth="0.5"
            />
          );
        }
      });
    });

    // 4. Parapets & Tower
    const parapetH = 3 * scale;
    if (showTower) {
      const overhang = 3 * scale;
      const extendedTowerX = towerStartX - overhang;
      const extendedTowerW = towerWidth + (2 * overhang);

      const leftParapetWidth = towerStartX - startX;
      const rightParapetWidth = (startX + totalWidth) - (towerStartX + towerWidth);

      elements.push(
        <rect
          key="parapet-left-side"
          x={startX}
          y={roofTopY - parapetH}
          width={leftParapetWidth}
          height={parapetH}
          fill="#002244"
          stroke="#00aaff"
          strokeWidth="0.4"
        />
      );

      elements.push(
        <rect
          key="parapet-right-side"
          x={towerStartX + towerWidth}
          y={roofTopY - parapetH}
          width={rightParapetWidth}
          height={parapetH}
          fill="#002244"
          stroke="#00aaff"
          strokeWidth="0.4"
        />
      );

      elements.push(
        <rect
          key="tower-roof-slab"
          x={extendedTowerX}
          y={towerRoofY}
          width={extendedTowerW}
          height={SLAB_H}
          fill={isSection ? "#002244" : "#001122"}
          stroke="#00aaff"
          strokeWidth="0.5"
        />
      );

      elements.push(
        <rect
          key="tower-parapet"
          x={extendedTowerX}
          y={towerRoofY - parapetH}
          width={extendedTowerW}
          height={parapetH}
          fill="#002244"
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
          fill="#002244"
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

  Array.from({ length: parsedTotalFloors }).forEach((_, index) => {
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
  const sectionStartX = elevationStartX + baseBuiltUpWidth + 25 * scale;
  
  // 👉 Stable & Fixed Elevation Position (Always safely below the first row of floor plans)
  const elevationRowStartY = topmostY + MANUAL_ELEV_Y_OFFSET;

  const tableTotalWidth = baseBuiltUpWidth + 50 * scale;

  // 👉 Dynamic Footing & Column Specifications Based on Floor Count
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
    { label: "SLAB & PARAPET DETAILS", val: `Roof & Floor Slabs: ${formatDim(SLAB_H)} Thick | Parapet: 3'-0\" Height` },
    { label: "PLINTH & FLOOR HEIGHTS", val: `Plinth: 1'-6\" Above GL | Floor-to-Floor: ${formatDim(FLOOR_H)}` },
  ];

const tableHeaderH = 15 * scale; 
  const tableRowH = 6.5 * scale;   // 👉 Yahan row height ko 8 se kam karke 6.5 kar diya gaya hai
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

      {/* Render Floor Plans with Floor-wise Areas */}
      {Array.from({ length: parsedTotalFloors }).map((_, index) => {
        let shiftX = 0;
        let shiftY = 0;

        if (parsedTotalFloors > 1) {
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

        const floorName = getFloorName(index);
        const currFloorPoints = getFloorPoints(floorName);

        const translatedPoints = currFloorPoints.map((p) => ({
          x: p.x - shiftX,
          y: p.y - shiftY,
        }));

        const p0 = translatedPoints[0];
        const p1 = translatedPoints[1];
        const p2 = translatedPoints[2];
        const p3 = translatedPoints[3];

        const wallPx = (8 / 12) * scale;
        const innerPoints = [
          { x: p0.x + wallPx, y: p0.y + wallPx },
          { x: p1.x - wallPx, y: p1.y + wallPx },
          { x: p2.x - wallPx, y: p2.y - wallPx },
          { x: p3.x + wallPx, y: p3.y - wallPx },
        ];

        const i0 = innerPoints[0];
        const i1 = innerPoints[1];
        const i2 = innerPoints[2];
        const i3 = innerPoints[3];

        const tCenterX = translatedPoints.reduce((sum, p) => sum + p.x, 0) / translatedPoints.length;
        const tCenterY = translatedPoints.reduce((sum, p) => sum + p.y, 0) / translatedPoints.length;
        const centerPt = { x: tCenterX, y: tCenterY };

        const bottomY = Math.max(...translatedPoints.map(p => p.y));
        const labelY = bottomY + (12 * scale);

        const wallPathData = `
          M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z 
          M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z
        `;

        const currWidth = Math.abs(p1.x - p0.x);
        const isNarrowWidth = currWidth < (15 * scale);
        const textRotation = isNarrowWidth ? -90 : 0;

        const currentFloorArea = floorBuiltUpAreas && floorBuiltUpAreas[floorName] !== undefined 
          ? floorBuiltUpAreas[floorName] 
          : Math.round(baseArea);

        return (
          <g key={index}>
            <path d={wallPathData} fill="url(#wallHatch)" fillRule="evenodd" stroke="red" strokeWidth="0.5" strokeLinejoin="round" />
            <path d={`M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z`} fill="none" stroke="red" strokeWidth="0.5" strokeLinejoin="round" />
            
            <text 
              x={tCenterX} 
              y={tCenterY} 
              fill="#ffffff" 
              fontSize="7.5" 
              fontWeight="bold" 
              textAnchor="middle" 
              dominantBaseline="middle"
              transform={`rotate(${textRotation}, ${tCenterX}, ${tCenterY})`}
              style={{ fontFamily: "sans-serif", opacity: 0.85 }}
            >
              {currentFloorArea} SQ.FT
            </text>

            {renderSideDim(p0, p1, centerPt)} 
            {renderSideDim(p3, p2, centerPt)} 
            {renderSideDim(p1, p2, centerPt)} 
            {renderSideDim(p0, p3, centerPt)} 

            <text 
              x={tCenterX} 
              y={labelY} 
              textAnchor="middle" 
              dominantBaseline="middle" 
              fill="#000000" 
              style={{ fontWeight: "900", fontSize: "8.5px", fontFamily: "sans-serif", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "3px" }}
            >
              {floorName}
            </text>
          </g>
        );
      })}

      {/* ELEVATION & SECTION */}
      <g transform={`translate(0, ${elevationRowStartY})`}>
        
        {/* 1. FRONT ELEVATION */}
        <g className="elevation-view">
          {renderTopWidthDim(elevationStartX, baseBuiltUpWidth, -elevationHeight, formatDim(baseBuiltUpWidth))}

          <rect
            x={elevationStartX}
            y={-elevationHeight}
            width={baseBuiltUpWidth}
            height={elevationHeight}
            stroke="#00aaff"
            strokeWidth="0.6"
            fill="none"
          />

          {renderBuildingStructure(elevationStartX, baseBuiltUpWidth, widthColumnCount, false, true)}

          <line x1={elevationStartX - PLINTH_OFFSET - 25} y1={0} x2={elevationStartX + baseBuiltUpWidth + PLINTH_OFFSET + 25} y2={0} stroke="#00aaff" strokeWidth="0.6" strokeDasharray="4" />
          <text x={elevationStartX + baseBuiltUpWidth / 2 + 110} y={2} fill="#00aaff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
            PLINTH LEVEL 
          </text>

          <line x1={elevationStartX - 25} y1={PLINTH_H} x2={elevationStartX + baseBuiltUpWidth + 25} y2={PLINTH_H} stroke="#00aaff" strokeWidth="0.6" />
          {renderEarthSymbol(elevationStartX - 25, elevationStartX, PLINTH_H)}
          {renderEarthSymbol(elevationStartX + baseBuiltUpWidth, elevationStartX + baseBuiltUpWidth + 25, PLINTH_H)}

          <text x={elevationStartX + baseBuiltUpWidth / 2 + 120} y={PLINTH_H + 4} fill="#00aaff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
            GROUND LEVEL
          </text>

          {hasBasement && (
            <g>
              <rect x={elevationStartX} y={PLINTH_H} width={baseBuiltUpWidth} height={BASEMENT_H} stroke="#00aaff" strokeWidth="0.5" fill="none" />
              {renderHeightDim(elevationStartX, PLINTH_H, PLINTH_H + BASEMENT_H, formatDim(BASEMENT_H))}
              
              <line 
                x1={elevationStartX + WALL_THICKNESS} 
                y1={PLINTH_H + BASEMENT_H - (3 * scale)} 
                x2={elevationStartX + baseBuiltUpWidth - WALL_THICKNESS} 
                y2={PLINTH_H + BASEMENT_H - (3 * scale)} 
                stroke="#00aaff" 
                strokeWidth="0.4" 
                strokeDasharray="2" 
              />
              
              <line
                x1={elevationStartX + baseBuiltUpWidth}
                y1={PLINTH_H + BASEMENT_H / 2}
                x2={elevationStartX + baseBuiltUpWidth + 6 * scale}
                y2={PLINTH_H + BASEMENT_H / 2}
                stroke="#00aaff"
                strokeWidth="0.5"
                strokeDasharray="2"
              />
              <rect
                x={elevationStartX + baseBuiltUpWidth + 6 * scale}
                y={PLINTH_H + BASEMENT_H / 2 - 7.5}
                width={95}
                height={15}
                fill="#000000"
                fillOpacity="0.92"
                stroke="#00aaff"
                strokeWidth="0.5"
                rx="2"
              />
              <text
                x={elevationStartX + baseBuiltUpWidth + 10 * scale + 35}
                y={PLINTH_H + BASEMENT_H / 2}
                fill="#00aaff"
                fontSize="7"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                BASEMENT ({formatDim(BASEMENT_H)})
              </text>
            </g>
          )}

          <text x={elevationStartX + baseBuiltUpWidth / 2} y={PLINTH_H + (hasBasement ? BASEMENT_H : 0) + 45} fill="#00aaff" fontSize="10" fontWeight="bold" textAnchor="middle">
            FRONT ELEVATION
          </text>
        </g>

        {/* 2. SECTION VIEW */}
        <g className="section-view" transform={`translate(${sectionStartX - elevationStartX}, 0)`}>
          {renderTopWidthDim(elevationStartX, baseBuiltUpHeight, -sectionHeight, formatDim(baseBuiltUpHeight))}

          <text x={elevationStartX + (baseBuiltUpHeight / 2)} y={PLINTH_H + (hasBasement ? BASEMENT_H : 0) + 45} fill="#00aaff" fontSize="10" fontWeight="bold" textAnchor="middle">
            SECTION VIEW
          </text>

          <rect
            x={elevationStartX}
            y={-sectionHeight}
            width={baseBuiltUpHeight}
            height={sectionHeight}
            stroke="#00aaff"
            strokeWidth="0.5"
            fill="none"
          />

          {renderBuildingStructure(elevationStartX, baseBuiltUpHeight, depthColumnCount, true, false)}

          {renderRightFloorLabels(elevationStartX, baseBuiltUpHeight)}

          <line x1={elevationStartX - PLINTH_OFFSET - 25} y1={0} x2={elevationStartX + baseBuiltUpHeight + PLINTH_OFFSET + 25} y2={0} stroke="#00aaff" strokeWidth="0.6" strokeDasharray="4" />
          <line x1={elevationStartX - 25} y1={PLINTH_H} x2={elevationStartX + baseBuiltUpHeight + 25} y2={PLINTH_H} stroke="#00aaff" strokeWidth="0.6" />

          {renderEarthSymbol(elevationStartX - 25, elevationStartX, PLINTH_H)}
          {renderEarthSymbol(elevationStartX + baseBuiltUpHeight, elevationStartX + baseBuiltUpHeight + 25, PLINTH_H)}

          {hasBasement && (
            <g>
              <rect x={elevationStartX} y={PLINTH_H} width={baseBuiltUpHeight} height={BASEMENT_H} stroke="#00aaff" strokeWidth="0.5" fill="none" />
              <line 
                x1={elevationStartX + WALL_THICKNESS} 
                y1={PLINTH_H + BASEMENT_H - (3 * scale)} 
                x2={elevationStartX + baseBuiltUpHeight - WALL_THICKNESS} 
                y2={PLINTH_H + BASEMENT_H - (3 * scale)} 
                stroke="#00aaff" 
                strokeWidth="0.4" 
                strokeDasharray="2" 
              />
            </g>
          )}
        </g>
      </g>

      {/* 3. STRUCTURAL SPECIFICATIONS & SCHEDULE TABLE */}
      <g transform={`translate(${elevationStartX + MANUAL_TABLE_X_OFFSET}, ${elevationRowStartY + MANUAL_TABLE_Y_OFFSET})`}>
        <rect
          x="0"
          y="0"
          width={tableTotalWidth}
          height={tableDynamicHeight}
          fill="#000000"
          fillOpacity="0.95"
          stroke="#00aaff"
          strokeWidth="0.8"
          rx="4"
        />
        <rect
          x="0"
          y="0"
          width={tableTotalWidth}
          height={12 * scale}
          fill="#002244"
          stroke="#00aaff"
          strokeWidth="0.6"
        />
        <text
          x={tableTotalWidth / 2}
          y={7 * scale}
          fill="#00aaff"
          fontSize="9"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          STRUCTURAL SPECIFICATIONS & SCHEDULE OF FINISHES
        </text>

        {tableItems.map((item, idx) => {
          const rowY = 16 * scale + idx * 8 * scale;
          return (
            <g key={idx}>
              <text x={2 * scale} y={rowY} fill="#ffffff" fontSize="7.5" fontWeight="bold" dominantBaseline="middle">
                • {item.label}:
              </text>
              <text x={25 * scale} y={rowY} fill="#00aaff" fontSize="7.5" dominantBaseline="middle">
                {item.val}
              </text>
              <line x1={5 * scale} y1={rowY + 4 * scale} x2={tableTotalWidth - 5 * scale} y2={rowY + 4 * scale} stroke="#003366" strokeWidth="0.4" />
            </g>
          );
        })}
      </g>
    </g>
  );
}