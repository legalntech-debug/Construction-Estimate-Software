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

  // --- DYNAMIC BOUNDARY TEXT & COMPASS ROTATION (PLOT DIMENSIONS REMAIN FIXED) ---
  const opt = (roadFacingOption || "").toUpperCase();
  
  const allDirs = ["NORTH", "SOUTH", "EAST", "WEST"];
  const foundDirs: { dir: string; index: number }[] = [];
  allDirs.forEach((dir) => {
    const idx = opt.indexOf(dir);
    if (idx !== -1) {
      foundDirs.push({ dir, index: idx });
    }
  });
  foundDirs.sort((a, b) => a.index - b.index);

  let mainRoad = "SOUTH";
  if (foundDirs.length > 0) {
    mainRoad = foundDirs[0].dir;
  }

  // Assuming standard inputs passed to props:
  // top = North, bottom = South, left = West, right = East
  const bNorth = topBoundary;
  const bSouth = bottomBoundary;
  const bWest = leftBoundary;
  const bEast = rightBoundary;

  let activeBottomBoundary = bSouth;
  let activeTopBoundary = bNorth;
  let activeLeftBoundary = bWest;
  let activeRightBoundary = bEast;
  let compassRotation = 0;

  if (mainRoad === "NORTH") {
    activeBottomBoundary = bNorth;
    activeTopBoundary = bSouth;
    activeLeftBoundary = bEast;
    activeRightBoundary = bWest;
    compassRotation = 180;
  } else if (mainRoad === "SOUTH") {
    activeBottomBoundary = bSouth;
    activeTopBoundary = bNorth;
    activeLeftBoundary = bWest;
    activeRightBoundary = bEast;
    compassRotation = 0;
  } else if (mainRoad === "EAST") {
    activeBottomBoundary = bEast;
    activeTopBoundary = bWest;
    activeLeftBoundary = bSouth;
    activeRightBoundary = bNorth;
    compassRotation = 90;
  } else if (mainRoad === "WEST") {
    activeBottomBoundary = bWest;
    activeTopBoundary = bEast;
    activeLeftBoundary = bNorth;
    activeRightBoundary = bSouth;
    compassRotation = 270;
  }

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

    let perpX = -(p2.y - p1.y) / L;
    let perpY = (p2.x - p1.x) / L;
    const dx = midX - centerX;
    const dy = midY - centerY;
    if (perpX * dx + perpY * dy < 0) {
      perpX = -perpX;
      perpY = -perpY;
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
        <line x1={p1.x} y1={p1.y} x2={ext1_end.x} y2={ext1_end.y} stroke="white" strokeWidth="1" strokeDasharray="2" />
        <line x1={p2.x} y1={p2.y} x2={ext2_end.x} y2={ext2_end.y} stroke="white" strokeWidth="1" strokeDasharray="2" />

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
      {/* PLOT DIMENSIONS STRICTLY FIXED TO THEIR PHYSICAL SIDES (Width remains Width, Length remains Length) */}
      {renderSideDimension(pTopLeft, pTopRight, activeTopBoundary, dimB)}         {/* Top = Width (Side B) */}
      {renderSideDimension(pBottomLeft, pBottomRight, activeBottomBoundary, dimA)}   {/* Bottom = Width (Side A) */}
      {renderSideDimension(pTopRight, pBottomRight, activeRightBoundary, dimD)}     {/* Right = Length (Side D) */}
      {renderSideDimension(pTopLeft, pBottomLeft, activeLeftBoundary, dimC)}       {/* Left = Length (Side C) */}

      <g transform={`translate(${pBottomLeft.x - 120}, ${pBottomLeft.y + siteLayoutYOffset})`}>
        <text x="70" y="2" textAnchor="middle" dominantBaseline="middle" fill="white" style={{ fontSize: "18px", fontWeight: "bold" }}>
          SITE LAYOUT
        </text>
      </g>

      {/* COMPASS (DYNAMICALLY ROTATED BASED ON MAIN ROAD / FACING OPTION) */}
      {(() => {
        const isFourSide = opt.includes("4 SIDE");
        const isThreeSide = opt.includes("3 SIDE");
        
        const compassMap: Record<string, string> = {
          SOUTH: "EAST",
          NORTH: "WEST",
          EAST: "NORTH",
          WEST: "SOUTH"
        };
        const rightDir = compassMap[mainRoad] || "EAST";
        const hasRightRoad = isFourSide || isThreeSide || foundDirs.some(f => f.dir === rightDir);
        const extraRightOffset = hasRightRoad ? currentRoadHeight : 0;

        return (
          <g transform={`translate(${maxX + 120 + extraRightOffset}, ${pTopRight.y + 30}) rotate(${compassRotation})`}>
            <circle cx="0" cy="0" r="28" fill="#121212" stroke="white" strokeWidth="1.2" />
            <polygon points="0,-22 -22,11 0,5" fill="white" />
            <polygon points="0,-22 22,11 0,5" fill="#2c7ac9" stroke="white" strokeWidth="0.8" />
            <text x="0" y="-39" textAnchor="middle" dominantBaseline="middle" fill="white" transform={`rotate(${-compassRotation}, 0, -39)`} style={{ fontSize: "22px", fontWeight: "bold" }}>
              N
            </text>
          </g>
        );
      })()}
    </g>
  );
}