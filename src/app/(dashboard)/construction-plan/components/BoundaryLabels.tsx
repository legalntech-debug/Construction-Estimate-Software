import React from "react";

interface BoundaryLabelsProps {
  topBoundary: string;
  bottomBoundary: string;
  leftBoundary: string;
  rightBoundary: string;
  dimA: number;
  dimB: number;
  dimC: number;
  dimD: number;
  pTopLeft: { x: number; y: number };
  pTopRight: { x: number; y: number };
  pBottomLeft: { x: number; y: number };
  pBottomRight: { x: number; y: number };
  centerX: number;
  centerY: number;
  minX: number;
  maxX: number;
  roadFacingOption?: string;
  northAngle?: number;
  roadWidth?: number;
  measurementUnit?: "FEET" | "METERS";
}

export default function BoundaryLabels({
  topBoundary,
  bottomBoundary,
  leftBoundary,
  rightBoundary,
  dimA,
  dimB,
  dimC,
  dimD,
  pTopLeft,
  pTopRight,
  pBottomLeft,
  pBottomRight,
  centerX,
  centerY,
  minX,
  maxX,
  roadFacingOption = "1 SIDE ROAD (SOUTH)",
  northAngle = 0,
  roadWidth = 15,
  measurementUnit = "FEET",
}: BoundaryLabelsProps) {
  // Format dimension helper for Feet-Inches or Meters
  const formatDim = (val: number) => {
    if (measurementUnit === "METERS") {
      return `${Number(val || 0).toFixed(2)}m`;
    }
    const totalInches = Math.round((val || 0) * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'-${inches}"`;
  };

  const wrapText = (text: string, maxPerLine = 22) => {
    const clean = (text || "-").toUpperCase();
    if (clean.length <= maxPerLine) return [clean];
    
    const words = clean.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= maxPerLine) {
        currentLine = currentLine ? currentLine + " " + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    return lines.slice(0, 2);
  };

  const scale = 5.5;
  const currentRoadHeight = roadWidth * scale;
  const siteLayoutYOffset = 115 + (currentRoadHeight - (15 * scale));

  // Universal helper function to render side dimensions and boundary texts parallel to any slanted/angled side
  const renderSideDimension = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    boundaryText: string,
    dimVal: number
  ) => {
    const L = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Tangent unit vector along the line
    const tx = (p2.x - p1.x) / L;
    const ty = (p2.y - p1.y) / L;

    // Perpendicular normal vector pointing strictly outward from the plot center
    let perpX = -ty;
    let perpY = tx;
    const dx = midX - centerX;
    const dy = midY - centerY;
    if (perpX * dx + perpY * dy < 0) {
      perpX = ty;
      perpY = -tx;
    }

    const dist = 22; 
    const overshoot = 6;    
    const boxHalfWidth = 28;

    const ext1_end = { x: p1.x + perpX * (dist + overshoot), y: p1.y + perpY * (dist + overshoot) };
    const ext2_end = { x: p2.x + perpX * (dist + overshoot), y: p2.y + perpY * (dist + overshoot) };

    const textDist = dist + 40;
    const textPosX = midX + perpX * textDist;
    const textPosY = midY + perpY * textDist;

    return (
      <g>
        {/* Extension dashed lines */}
        <line x1={p1.x} y1={p1.y} x2={ext1_end.x} y2={ext1_end.y} stroke="white" strokeWidth="1" strokeDasharray="2" />
        <line x1={p2.x} y1={p2.y} x2={ext2_end.x} y2={ext2_end.y} stroke="white" strokeWidth="1" strokeDasharray="2" />

        {/* Boundary Name Text (Parallel to side angle) */}
        <text 
          x={textPosX} 
          y={textPosY} 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fill="white" 
          transform={`rotate(${angle}, ${textPosX}, ${textPosY})`} 
          style={{ fontSize: "14px", fontWeight: "900" }}
        >
          {wrapText(boundaryText, 25).map((line, idx) => (
            <tspan key={idx} x={textPosX} dy={idx === 0 ? 0 : 16}>{line}</tspan>
          ))}
        </text>

        {/* Dimension Line, Arrows and Value Box */}
        <g transform={`translate(${midX + perpX * dist}, ${midY + perpY * dist}) rotate(${angle})`}>
          <polygon points={`${-L / 2},0 ${-L / 2 + 7},-3.5 ${-L / 2 + 7},3.5`} fill="white" />
          <line x1={-L / 2} y1="0" x2={-boxHalfWidth} y2="0" stroke="white" strokeWidth="1" />

          <polygon points={`${L / 2},0 ${L / 2 - 7},-3.5 ${L / 2 - 7},3.5`} fill="white" />
          <line x1={boxHalfWidth} y1="0" x2={L / 2} y2="0" stroke="white" strokeWidth="1" />

          <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="white" style={{ fontSize: "12px", fontWeight: "bold" }}>
            {formatDim(dimVal)}
          </text>
        </g>
      </g>
    );
  };

  return (
    <g style={{ fontSize: "14px", fontWeight: "bold", fontFamily: "sans-serif" }}>
      {/* TOP BOUNDARY & DIMENSION (SIDE B) */}
      {renderSideDimension(pTopLeft, pTopRight, topBoundary, dimB)}

      {/* BOTTOM BOUNDARY & DIMENSION (SIDE A) */}
      {renderSideDimension(pBottomLeft, pBottomRight, bottomBoundary, dimA)}

      {/* RIGHT BOUNDARY & DIMENSION (SIDE D) */}
      {renderSideDimension(pTopRight, pBottomRight, rightBoundary, dimD)}

      {/* LEFT BOUNDARY & DIMENSION (SIDE C) */}
      {renderSideDimension(pTopLeft, pBottomLeft, leftBoundary, dimC)}

      {/* DYNAMIC ROAD WIDTH KE SATH MOVE HONE WALA "SITE LAYOUT" TEXT */}
      <g transform={`translate(${pBottomLeft.x - 120}, ${pBottomLeft.y + siteLayoutYOffset})`}>
        <text x="70" y="2" textAnchor="middle" dominantBaseline="middle" fill="white" style={{ fontSize: "18px", fontWeight: "bold" }}>
          SITE LAYOUT
        </text>
      </g>

      {/* PLOT KE TOP-RIGHT SIDE ME ROTATABLE NORTH SYMBOL */}
      {(() => {
        let rotation = 0; 
        const opt = (roadFacingOption || "").toUpperCase();

        if (opt.includes("SOUTH")) {
          rotation = 0;    
        } else if (opt.includes("NORTH")) {
          rotation = 180;  
        } else if (opt.includes("EAST")) {
          rotation = 90;   
        } else if (opt.includes("WEST")) {
          rotation = 270;  
        }

        return (
          <g transform={`translate(${maxX + 180}, ${pTopRight.y + 30}) rotate(${rotation})`}>
            <circle cx="0" cy="0" r="50" fill="#121212" stroke="white" strokeWidth="2" />
            <polygon points="0,-40 -40,20 0,8" fill="white" />
            <polygon points="0,-40 40,20 0,8" fill="#2c7ac9" stroke="white" strokeWidth="1" />
            <text x="0" y="-70" textAnchor="middle" dominantBaseline="middle" fill="white" transform={`rotate(${-rotation}, 0, -70)`} style={{ fontSize: "40px", fontWeight: "bold" }}>
              N
            </text>
          </g>
        );
      })()}
    </g>
  );
}