import React from "react";

interface CadFloorElevationRendererProps {
  totalFloors: number;
  builtUpPoints: { x: number; y: number }[];
  scale: number;
  selectedFloors?: string[];
  roadWidth?: number | string;
  roadFacingOption?: string;
  measurementUnit?: "FEET" | "METERS";
}

export default function CadFloorElevationRenderer({
  totalFloors,
  builtUpPoints,
  scale,
  selectedFloors = [],
  roadWidth = 20,
  roadFacingOption = "1 SIDE ROAD (SOUTH)",
  measurementUnit = "FEET",
}: CadFloorElevationRendererProps) {
  if (!builtUpPoints || builtUpPoints.length < 4) return null;

  const parsedTotalFloors = Number(totalFloors) || selectedFloors.length || 1;

  // Precise Floor Ranking
  const processedFloors = React.useMemo(() => {
    if (!selectedFloors || selectedFloors.length === 0) return [];

    const getFloorRank = (name: string) => {
      const upper = name.toUpperCase();
      if (upper.includes("TOWER")) return 999;
      if (upper.includes("BASEMENT")) return 0;
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

  const getFloorName = (index: number) => {
    if (processedFloors && processedFloors[index] && processedFloors[index].trim() !== "") {
      return processedFloors[index];
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

  // Road detection: Only LEFT road should push the floor plans further left
  const opt = (roadFacingOption || "").toUpperCase();
  const hasLeftRoad = opt.includes("4 SIDE") || opt.includes("3 SIDE") || opt.includes("WEST") || opt.includes("LEFT");

  const numericRoadWidth = Number(roadWidth) || 20;
  const baseGap = 45 * scale; 
  const roadOffset = hasLeftRoad ? (numericRoadWidth * scale * 0.8) : 0; // Fixed: removed hasRightRoad dependency
  const plotGap = baseGap + roadOffset;

  const builtUpWidth = Math.abs(builtUpPoints[1].x - builtUpPoints[0].x);
  const builtUpHeight = Math.abs(builtUpPoints[3].y - builtUpPoints[0].y);
  const interFloorGap = 15 * scale;
  const rowHeightGap = builtUpHeight + 25 * scale;

  const itemsPerRow = processedFloors.length > 6 ? 4 : 3;

  // Helper to render parallel dimension for any side of the polygon
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
            x="0" 
            y="1" 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="yellow" 
            style={{ fontSize: "9px", fontWeight: "bold", paintOrder: "stroke", stroke: "#000000", strokeWidth: "3px" }}
          >
            {formatDim(L)}
          </text>
        </g>
      </g>
    );
  };

  return (
    <g>
      <defs>
        <pattern id="wallHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#666666" strokeWidth="0.6" />
        </pattern>
      </defs>

      {Array.from({ length: parsedTotalFloors }).map((_, index) => {
        let shiftX = 0;
        let shiftY = 0;

        if (parsedTotalFloors > 1) {
          const rowIndex = Math.floor(index / itemsPerRow);
          const colIndex = rowIndex % 2 === 0 
            ? (itemsPerRow - 1) - (index % itemsPerRow) 
            : (index % itemsPerRow);

          shiftX = plotGap + (colIndex * (builtUpWidth + interFloorGap));
          shiftY = rowIndex * rowHeightGap;
        } else {
          shiftX = plotGap;
          shiftY = 0;
        }

        const translatedPoints = builtUpPoints.map((p) => ({
          x: p.x - shiftX,
          y: p.y - shiftY,
        }));

        const p0 = translatedPoints[0]; // Top-Left
        const p1 = translatedPoints[1]; // Top-Right
        const p2 = translatedPoints[2]; // Bottom-Right
        const p3 = translatedPoints[3]; // Bottom-Left

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

        return (
          <g key={index}>
            <path d={wallPathData} fill="url(#wallHatch)" fillRule="evenodd" stroke="red" strokeWidth="0.5" strokeLinejoin="round" />
            <path d={`M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z`} fill="none" stroke="red" strokeWidth="0.5" strokeLinejoin="round" />
            
            <text 
              x={tCenterX} 
              y={tCenterY} 
              fill="#ffffff" 
              fontSize="8" 
              fontWeight="bold" 
              textAnchor="middle" 
              dominantBaseline="middle"
              style={{ fontFamily: "sans-serif", opacity: 0.85 }}
            >
              PLANNING AREA
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
              {getFloorName(index)}
            </text>
          </g>
        );
      })}
    </g>
  );
}