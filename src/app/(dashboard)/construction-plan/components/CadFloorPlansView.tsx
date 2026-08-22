import React from "react";
import { formatDim, renderSideDim } from "./CadDimUtils";

interface CadFloorPlansViewProps {
  processedFloors: string[];
  itemsPerRow: number;
  plotGap: number;
  baseBuiltUpWidth: number;
  interFloorGap: number;
  rowHeightGap: number;
  scale: number;
  getFloorPoints: (floorName: string) => { x: number; y: number }[];
  floorBuiltUpAreas: { [key: string]: number };
  baseArea: number;
  floorData: Record<string, any>;
  measurementUnit?: "FEET" | "METERS";
  MANUAL_TOWER_DIM_X_OFFSET: number;
  MANUAL_TOWER_DIM_Y_OFFSET: number;
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
  floorBuiltUpAreas,
  baseArea,
  floorData,
  measurementUnit,
  MANUAL_TOWER_DIM_X_OFFSET,
  MANUAL_TOWER_DIM_Y_OFFSET,
}: CadFloorPlansViewProps) {
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

        const isTowerFloor = floorName.toUpperCase().includes("TOWER");

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

        const rawArea = floorBuiltUpAreas && floorBuiltUpAreas[floorName];
        const currentFloorArea = (rawArea !== undefined && rawArea > 0) ? rawArea : baseArea;

        const tW = (floorInfoWidth: number) => floorInfoWidth ? floorInfoWidth * scale : 10 * scale;
        const tH = (floorInfoLength: number) => floorInfoLength ? floorInfoLength * scale : 10 * scale;
        
        const floorInfo = floorData && floorData[floorName];
        const towerWVal = tW(floorInfo?.width);
        const towerHVal = tH(floorInfo?.length);
        
        const defaultTowerX = p0.x + (Math.abs(p1.x - p0.x) * 0.6) - (towerWVal / 2);
        const defaultTowerY = p0.y + 15 * scale;

        const tX = p0.x + (floorInfo?.x !== undefined ? floorInfo.x * scale : (defaultTowerX - p0.x));
        const tY = p0.y + (floorInfo?.y !== undefined ? floorInfo.y * scale : (defaultTowerY - p0.y));

        const twW = (4 / 12) * scale;
        const towerInnerX = tX + twW;
        const towerInnerY = tY + twW;
        const towerInnerW = towerWVal - (2 * twW);
        const towerInnerH = towerHVal - (2 * twW);

        const towerWallPath = `
          M ${tX} ${tY} L ${tX + towerWVal} ${tY} L ${tX + towerWVal} ${tY + towerHVal} L ${tX} ${tY + towerHVal} Z 
          M ${towerInnerX} ${towerInnerY} L ${towerInnerX + towerInnerW} ${towerInnerY} L ${towerInnerX + towerInnerW} ${towerInnerY + towerInnerH} L ${towerInnerX} ${towerInnerY + towerInnerH} Z
        `;

        const towerLeftDist = tX - p0.x;
        const towerRightDist = p1.x - (tX + towerWVal);
        const towerTopDist = tY - p0.y;
        const towerBottomDist = p3.y - (tY + towerHVal);
        
        const dimLineY = tY + MANUAL_TOWER_DIM_Y_OFFSET;
        const dimLineX = tX + MANUAL_TOWER_DIM_X_OFFSET;

        return (
          <g key={index}>
            <path d={wallPathData} fill="url(#wallHatch)" fillRule="evenodd" stroke="red" strokeWidth="0.5" strokeLinejoin="round" />
            <path d={`M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} L ${i3.x} ${i3.y} Z`} fill="none" stroke="red" strokeWidth="0.5" strokeLinejoin="round" />
            
            {isTowerFloor ? (
              <>
                <path d={towerWallPath} fill="url(#wallHatch)" fillRule="evenodd" stroke="#f59e0b" strokeWidth="0.6" strokeLinejoin="round" />
                <path d={`M ${towerInnerX} ${towerInnerY} L ${towerInnerX + towerInnerW} ${towerInnerY} L ${towerInnerX + towerInnerW} ${towerInnerY + towerInnerH} L ${towerInnerX} ${towerInnerY + towerInnerH} Z`} fill="none" stroke="#f59e0b" strokeWidth="0.5" />
                
                <text x={tX + towerWVal/2} y={tY + towerHVal/2} fill="#f59e0b" fontSize="6.5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                  {formatDim(towerWVal, scale, measurementUnit)} x {formatDim(towerHVal, scale, measurementUnit)}
                </text>

                <g>
                  <line x1={p0.x} y1={tY} x2={p0.x} y2={dimLineY - 2} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={tX} y1={tY} x2={tX} y2={dimLineY - 2} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={p0.x} y1={dimLineY} x2={tX} y2={dimLineY} stroke="#f59e0b" strokeWidth="0.5" />
                  <text x={(p0.x + tX) / 2} y={dimLineY - 3} fill="#f59e0b" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "2px" }}>
                    {formatDim(towerLeftDist, scale, measurementUnit)}
                  </text>
                </g>

                <g>
                  <line x1={tX + towerWVal} y1={tY} x2={tX + towerWVal} y2={dimLineY - 2} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={p1.x} y1={tY} x2={p1.x} y2={dimLineY - 2} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={tX + towerWVal} y1={dimLineY} x2={p1.x} y2={dimLineY} stroke="#f59e0b" strokeWidth="0.5" />
                  <text x={(tX + towerWVal + p1.x) / 2} y={dimLineY - 3} fill="#f59e0b" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "2px" }}>
                    {formatDim(towerRightDist, scale, measurementUnit)}
                  </text>
                </g>

                <g>
                  <line x1={tX} y1={p0.y} x2={dimLineX - 2} y2={p0.y} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={tX} y1={tY} x2={dimLineX - 2} y2={tY} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={dimLineX} y1={p0.y} x2={dimLineX} y2={tY} stroke="#f59e0b" strokeWidth="0.5" />
                  <g transform={`translate(${dimLineX}, ${(p0.y + tY) / 2}) rotate(-90)`}>
                    <text x="0" y="-3" textAnchor="middle" dominantBaseline="middle" fill="#f59e0b" fontSize="5.5" fontWeight="bold" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "2px" }}>
                      {formatDim(towerTopDist, scale, measurementUnit)}
                    </text>
                  </g>
                </g>

                <g>
                  <line x1={tX} y1={tY + towerHVal} x2={dimLineX - 2} y2={tY + towerHVal} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={tX} y1={p3.y} x2={dimLineX - 2} y2={p3.y} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="2" />
                  <line x1={dimLineX} y1={tY + towerHVal} x2={dimLineX} y2={p3.y} stroke="#f59e0b" strokeWidth="0.5" />
                  <g transform={`translate(${dimLineX}, ${(tY + towerHVal + p3.y) / 2}) rotate(-90)`}>
                    <text x="0" y="-3" textAnchor="middle" dominantBaseline="middle" fill="#f59e0b" fontSize="5.5" fontWeight="bold" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "2px" }}>
                      {formatDim(towerBottomDist, scale, measurementUnit)}
                    </text>
                  </g>
                </g>

                <text x={tCenterX} y={p0.y + (tY - p0.y) / 2} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                  OPEN TERRACE
                </text>
                <text x={tCenterX} y={tY + towerHVal + (p3.y - (tY + towerHVal)) / 2} fill="#00aaff" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                  OPEN TERRACE
                </text>
              </>
            ) : (
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
            )}

            {renderSideDim(p0, p1, centerPt, scale, measurementUnit)} 
            {renderSideDim(p3, p2, centerPt, scale, measurementUnit)} 
            {renderSideDim(p1, p2, centerPt, scale, measurementUnit)} 
            {renderSideDim(p0, p3, centerPt, scale, measurementUnit)} 

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
    </g>
  );
}