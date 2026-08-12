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
  northAngle?: number; // North symbol rotation angle in degrees
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
  northAngle = 0, // Default rotation 0 (North pointing up)
}: BoundaryLabelsProps) {
  const angleTop = Math.atan2(pTopRight.y - pTopLeft.y, pTopRight.x - pTopLeft.x) * (180 / Math.PI);
  const topWidth = pTopRight.x - pTopLeft.x;

  const midX = (pTopLeft.x + pTopRight.x) / 2;
  const midY = (pTopLeft.y + pTopRight.y) / 2;
  const distDim = -20; 
  const nx = -Math.sin((angleTop * Math.PI) / 180);
  const ny = Math.cos((angleTop * Math.PI) / 180);

  const boxHalfWidth = 22; 
  const overshoot = 6;     

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

  return (
    <g style={{ fontSize: "14px", fontWeight: "bold", fontFamily: "sans-serif" }}>
      {/* TOP BOUNDARY & DIMENSION */}
      <g>
        <line x1={pTopLeft.x} y1={pTopLeft.y} x2={pTopLeft.x + nx * (distDim - overshoot)} y2={pTopLeft.y + ny * (distDim - overshoot)} stroke="black" strokeWidth="1" strokeDasharray="2" />
        <line x1={pTopRight.x} y1={pTopRight.y} x2={pTopRight.x + nx * (distDim - overshoot)} y2={pTopRight.y + ny * (distDim - overshoot)} stroke="black" strokeWidth="1" strokeDasharray="2" />
        
        <text x={midX + nx * (distDim - 34)} y={midY + ny * (distDim - 34)} textAnchor="middle" dominantBaseline="middle" fill="black" transform={`rotate(${angleTop}, ${midX + nx * (distDim - 45)}, ${midY + ny * (distDim - 45)})`} style={{ fontSize: "14px", fontWeight: "900" }}>
          {wrapText(topBoundary, 25).map((line, idx) => (
            <tspan key={idx} x={midX + nx * (distDim - 45)} dy={idx === 0 ? 0 : 16}>{line}</tspan>
          ))}
        </text>

        <g transform={`translate(${midX + nx * distDim}, ${midY + ny * distDim}) rotate(${angleTop})`}>
          <polygon points={`${-topWidth / 2},0 ${-topWidth / 2 + 7},-3.5 ${-topWidth / 2 + 7},3.5`} fill="black" />
          <line x1={-topWidth / 2} y1="0" x2={-boxHalfWidth} y2="0" stroke="black" strokeWidth="1" />

          <polygon points={`${topWidth / 2},0 ${topWidth / 2 - 7},-3.5 ${topWidth / 2 - 7},3.5`} fill="black" />
          <line x1={boxHalfWidth} y1="0" x2={topWidth / 2} y2="0" stroke="black" strokeWidth="1" />

          <rect x={-boxHalfWidth} y="-10" width={boxHalfWidth * 2} height="18" fill="none" />
          <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="black">{dimB}&apos;</text>
        </g>
      </g>

      {/* BOTTOM BOUNDARY / DIMENSION (SIDE A) */}
      <g>
        <line x1={pBottomLeft.x} y1={pBottomLeft.y} x2={pBottomLeft.x} y2={pBottomLeft.y + 30 + overshoot} stroke="black" strokeWidth="1" strokeDasharray="2" />
        <line x1={pBottomRight.x} y1={pBottomRight.y} x2={pBottomRight.x} y2={pBottomRight.y + 30 + overshoot} stroke="black" strokeWidth="1" strokeDasharray="2" />
        
        <text x={centerX} y={pBottomLeft.y + 50} textAnchor="middle" dominantBaseline="middle" fill="black" style={{ fontSize: "14px", fontWeight: "900" }}>
          {wrapText(bottomBoundary, 30).map((line, idx) => (
            <tspan key={idx} x={centerX} dy={idx === 0 ? 0 : 16}>{line}</tspan>
          ))}
        </text>

        <polygon points={`${pBottomLeft.x},${pBottomLeft.y + 22} ${pBottomLeft.x + 7},${pBottomLeft.y + 18.5} ${pBottomLeft.x + 7},${pBottomLeft.y + 25.5}`} fill="black" />
        <line x1={pBottomLeft.x} y1={pBottomLeft.y + 22} x2={centerX - boxHalfWidth} y2={pBottomLeft.y + 22} stroke="black" strokeWidth="1" />

        <polygon points={`${pBottomRight.x},${pBottomLeft.y + 22} ${pBottomRight.x - 7},${pBottomLeft.y + 18.5} ${pBottomRight.x - 7},${pBottomLeft.y + 25.5}`} fill="black" />
        <line x1={centerX + boxHalfWidth} y1={pBottomLeft.y + 22} x2={pBottomRight.x} y2={pBottomLeft.y + 22} stroke="black" strokeWidth="1" />

        <rect x={centerX - boxHalfWidth} y={pBottomLeft.y + 13} width={boxHalfWidth * 2} height="18" fill="none" />
        <text x={centerX} y={pBottomLeft.y + 22} textAnchor="middle" dominantBaseline="middle" fill="black">{dimA}&apos;</text>
      </g>

      {/* RIGHT BOUNDARY & DIMENSION */}
      <g>
        <line x1={pTopRight.x} y1={pTopRight.y} x2={pTopRight.x + 22 + overshoot} y2={pTopRight.y} stroke="black" strokeWidth="1" strokeDasharray="2" />
        <line x1={pBottomRight.x} y1={pBottomRight.y} x2={pBottomRight.x + 22 + overshoot} y2={pBottomRight.y} stroke="black" strokeWidth="1" strokeDasharray="2" />
        
        <polygon points={`${pTopRight.x + 22},${pTopRight.y} ${pTopRight.x + 18.5},${pTopRight.y + 7} ${pTopRight.x + 25.5},${pTopRight.y + 7}`} fill="black" />
        <line x1={pTopRight.x + 22} y1={pTopRight.y} x2={pTopRight.x + 22} y2={centerY - boxHalfWidth} stroke="black" strokeWidth="1" />

        <polygon points={`${pTopRight.x + 22},${pBottomRight.y} ${pTopRight.x + 18.5},${pBottomRight.y - 7} ${pTopRight.x + 25.5},${pBottomRight.y - 7}`} fill="black" />
        <line x1={pTopRight.x + 22} y1={centerY + boxHalfWidth} x2={pTopRight.x + 22} y2={pBottomRight.y} stroke="black" strokeWidth="1" />

        <text x={maxX + 70} y={centerY} textAnchor="middle" dominantBaseline="middle" fill="black" transform={`rotate(90, ${maxX + 70}, ${centerY})`} style={{ fontSize: "14px", fontWeight: "900" }}>
          {wrapText(rightBoundary, 25).map((line, idx) => (
            <tspan key={idx} x={maxX + 75} dy={idx === 0 ? 0 : 16}>{line}</tspan>
          ))}
        </text>

        <g transform={`translate(${maxX + 22}, ${centerY}) rotate(90)`}>
          <rect x={-boxHalfWidth} y="-9" width={boxHalfWidth * 2} height="18" fill="none" />
          <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="black">{dimD}&apos;</text>
        </g>
      </g>

      {/* LEFT BOUNDARY & DIMENSION */}
      <g>
        <line x1={pTopLeft.x} y1={pTopLeft.y} x2={pTopLeft.x - 22 - overshoot} y2={pTopLeft.y} stroke="black" strokeWidth="1" strokeDasharray="2" />
        <line x1={pBottomLeft.x} y1={pBottomLeft.y} x2={pBottomLeft.x - 22 - overshoot} y2={pBottomLeft.y} stroke="black" strokeWidth="1" strokeDasharray="2" />
        
        <polygon points={`${pTopLeft.x - 22},${pTopLeft.y} ${pTopLeft.x - 25.5},${pTopLeft.y + 7} ${pTopLeft.x - 18.5},${pTopLeft.y + 7}`} fill="black" />
        <line x1={pTopLeft.x - 22} y1={pTopLeft.y} x2={pTopLeft.x - 22} y2={centerY - boxHalfWidth} stroke="black" strokeWidth="1" />

        <polygon points={`${pTopLeft.x - 22},${pBottomLeft.y} ${pTopLeft.x - 25.5},${pBottomLeft.y - 7} ${pTopLeft.x - 18.5},${pBottomLeft.y - 7}`} fill="black" />
        <line x1={pTopLeft.x - 22} y1={centerY + boxHalfWidth} x2={pTopLeft.x - 22} y2={pBottomLeft.y} stroke="black" strokeWidth="1" />

        <text x={minX - 70} y={centerY} textAnchor="middle" dominantBaseline="middle" fill="black" transform={`rotate(-90, ${minX - 70}, ${centerY})`} style={{ fontSize: "14px", fontWeight: "900" }}>
          {wrapText(leftBoundary, 25).map((line, idx) => (
            <tspan key={idx} x={minX - 75} dy={idx === 0 ? 0 : 16}>{line}</tspan>
          ))}
        </text>

        <g transform={`translate(${minX - 22}, ${centerY}) rotate(-90)`}>
          <rect x={-boxHalfWidth} y="-9" width={boxHalfWidth * 2} height="18" fill="none" />
          <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="black">{dimC}&apos;</text>
        </g>
      </g>

 {/* ROAD KE NICHE "SITE LAYOUT" BOX (Aligned to the road's left corner) */}
      <g transform={`translate(${pBottomLeft.x - 120}, ${pBottomLeft.y + 115})`}>
        <rect x="0" y="-15" width="140" height="30" fill="white" stroke="black" strokeWidth="1" />
        <text x="70" y="2" textAnchor="middle" dominantBaseline="middle" fill="black" style={{ fontSize: "18px", fontWeight: "bold" }}>
          SITE LAYOUT
        </text>
      </g>

      {/* PLOT KE TOP-RIGHT SIDE ME ROTATABLE NORTH SYMBOL (Corrected Reversed Angles) */}
      {(() => {
        let rotation = 0; 
        
        const opt = (roadFacingOption || "").toUpperCase();

        // Reversed angle mapping to match exact geographical orientation
        if (opt.includes("SOUTH")) {
          rotation = 0;    // North points UP (0°)
        } else if (opt.includes("NORTH")) {
          rotation = 180;  // North points DOWN (180°)
        } else if (opt.includes("EAST")) {
          rotation = 90;   // North points LEFT (90°)
        } else if (opt.includes("WEST")) {
          rotation = 270;  // North points RIGHT (270°)
        }

        console.log("Road Facing:", opt, "-> Corrected North Rotation Angle:", rotation);

        return (
          <g transform={`translate(${maxX + 180}, ${pTopRight.y + 30}) rotate(${rotation})`}>
            <circle cx="0" cy="0" r="50" fill="white" stroke="black" strokeWidth="2" />
            <polygon points="0,-40 -40,20 0,8" fill="black" />
            <polygon points="0,-40 40,20 0,8" fill="#2c7ac9" stroke="black" strokeWidth="1" />
            <text x="0" y="-70" textAnchor="middle" dominantBaseline="middle" fill="black" transform={`rotate(${-rotation}, 0, -70)`} style={{ fontSize: "40px", fontWeight: "bold" }}>
              N
            </text>
          </g>
        );
      })()}
    </g>
  );
}