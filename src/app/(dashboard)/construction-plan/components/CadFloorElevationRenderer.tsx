import React from "react";

interface CadFloorElevationRendererProps {
  totalFloors: number;
  builtUpPoints: { x: number; y: number }[];
  scale: number;
  selectedFloors?: string[];
}

export default function CadFloorElevationRenderer({
  totalFloors,
  builtUpPoints,
  scale,
  selectedFloors = [],
}: CadFloorElevationRendererProps) {
  if (!builtUpPoints || builtUpPoints.length < 4) return null;

  const parsedTotalFloors = Number(totalFloors) || selectedFloors.length || 1;

  // 1. Precise Floor Ranking: Basement (0) -> Ground (1) -> First (2) -> Second (3) ... -> Tower (Last)
  const processedFloors = React.useMemo(() => {
    if (!selectedFloors || selectedFloors.length === 0) return [];

    const getFloorRank = (name: string) => {
      const upper = name.toUpperCase();
      if (upper.includes("TOWER")) return 999; // Tower always goes to the very end
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

  const builtUpWidth = Math.abs(builtUpPoints[1].x - builtUpPoints[0].x);
  const builtUpHeight = Math.abs(builtUpPoints[3].y - builtUpPoints[0].y);
  
  const widthFeet = (builtUpWidth / scale).toFixed(0);
  const heightFeet = (builtUpHeight / scale).toFixed(0);

  const plotGap = 30 * scale;
  const interFloorGap = 5 * scale;
  const rowHeightGap = builtUpHeight + 14 * scale; // Vertical row spacing

  // Rule: Agar total selected floors 6 se zyada hain toh 1 row mein 4 floors, warna 3 floors
  const itemsPerRow = processedFloors.length > 6 ? 4 : 3;

  return (
    <g>
      <defs>
        <pattern id="wallHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#666666" strokeWidth="0.6" />
        </pattern>
        <marker id="cadArrowOpen" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M1,1 L7,4 L1,7" fill="none" stroke="yellow" strokeWidth="1.2" />
        </marker>
        <marker id="cadArrowOpenRev" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
          <path d="M7,1 L1,4 L7,7" fill="none" stroke="yellow" strokeWidth="1.2" />
        </marker>
      </defs>

      {Array.from({ length: parsedTotalFloors }).map((_, index) => {
        const rowIndex = Math.floor(index / itemsPerRow);
        
        // Snake Layout: Even rows right-to-left, Odd rows left-to-right taaki second floor, first floor ke bilkul upar aaye
        const colIndex = rowIndex % 2 === 0 
          ? (itemsPerRow - 1) - (index % itemsPerRow) 
          : (index % itemsPerRow);

        const shiftX = plotGap + ((colIndex + 1) * builtUpWidth) + (colIndex * interFloorGap);
        const shiftY = rowIndex * rowHeightGap;

        const translatedPoints = builtUpPoints.map((p) => ({
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
        
        const bottomY = Math.max(...translatedPoints.map(p => p.y));
        const topY = Math.min(...translatedPoints.map(p => p.y));
        const leftX = Math.min(...translatedPoints.map(p => p.x));
        const rightX = Math.max(...translatedPoints.map(p => p.x));
        
        const labelY = bottomY + (5 * scale);

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

            {/* Width Dimension */}
            <g>
              <line x1={leftX} y1={topY - 4} x2={leftX} y2={topY - 14} stroke="yellow" strokeWidth="0.5" />
              <line x1={rightX} y1={topY - 4} x2={rightX} y2={topY - 14} stroke="yellow" strokeWidth="0.5" />
              <line x1={leftX} y1={topY - 9} x2={rightX} y2={topY - 9} stroke="yellow" strokeWidth="0.8" markerStart="url(#cadArrowOpenRev)" markerEnd="url(#cadArrowOpen)" />
              <text x={tCenterX} y={topY - 9} fill="yellow" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" style={{ paintOrder: "stroke", stroke: "#000000", strokeWidth: "4px" }}>
                {widthFeet}'-0"
              </text>
            </g>

            {/* Height Dimension */}
            <g>
              <line x1={rightX + 4} y1={topY} x2={rightX + 16} y2={topY} stroke="yellow" strokeWidth="0.5" />
              <line x1={rightX + 4} y1={bottomY} x2={rightX + 16} y2={bottomY} stroke="yellow" strokeWidth="0.5" />
              <line x1={rightX + 10} y1={topY} x2={rightX + 10} y2={bottomY} stroke="yellow" strokeWidth="0.8" markerStart="url(#cadArrowOpenRev)" markerEnd="url(#cadArrowOpen)" />
              <text x={rightX + 10} y={(topY + bottomY) / 2} fill="yellow" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(90, ${rightX + 10}, ${(topY + bottomY) / 2})`} style={{ paintOrder: "stroke", stroke: "#000000", strokeWidth: "4px" }}>
                {heightFeet}'-0"
              </text>
            </g>

            <text x={tCenterX} y={labelY} textAnchor="middle" dominantBaseline="middle" fill="#000000" style={{ fontWeight: "900", fontSize: "7.5px", fontFamily: "sans-serif", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "3px" }}>
              {getFloorName(index)}
            </text>
          </g>
        );
      })}
    </g>
  );
}