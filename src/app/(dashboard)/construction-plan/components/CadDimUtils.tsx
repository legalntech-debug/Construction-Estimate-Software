import React from "react";

export const formatDim = (valPx: number, scale: number, measurementUnit?: "FEET" | "METERS") => {
  const valFeet = valPx / scale;
  if (measurementUnit === "METERS") {
    return `${(valFeet * 0.3048).toFixed(2)}m`;
  }
  const totalInches = Math.round(valFeet * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'-${inches}"`;
};

export const renderSideDim = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  centerPt: { x: number; y: number },
  scale: number,
  measurementUnit?: "FEET" | "METERS"
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
          {formatDim(L, scale, measurementUnit)}
        </text>
      </g>
    </g>
  );
};

export const renderTopWidthDim = (startX: number, width: number, yLevel: number, label: string, scale: number) => {
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

export const renderHeightDim = (
  x: number, 
  yTop: number, 
  yBottom: number, 
  label: string, 
  direction: 'left' | 'right' = 'left', 
  color: string = '#00aaff',
  scale: number
) => {
  const midY = (yTop + yBottom) / 2;
  const dimX = direction === 'left' ? x - 2 * scale : x + 2 * scale; 
  
  return (
    <g>
      <line x1={x} y1={yTop} x2={dimX + (direction === 'left' ? -2 : 2)} y2={yTop} stroke={color} strokeWidth="0.4" strokeDasharray="2" />
      <line x1={x} y1={yBottom} x2={dimX + (direction === 'left' ? -2 : 2)} y2={yBottom} stroke={color} strokeWidth="0.4" strokeDasharray="2" />
      <line x1={dimX} y1={yTop} x2={dimX} y2={yBottom} stroke={color} strokeWidth="0.6" />
      <polygon points={`${dimX},${yTop} ${dimX - 2},${yTop + 4} ${dimX + 2},${yTop + 4}`} fill={color} />
      <polygon points={`${dimX},${yBottom} ${dimX - 2},${yBottom - 4} ${dimX + 2},${yBottom - 4}`} fill={color} />
      
      <g transform={`translate(${dimX}, ${midY}) rotate(-90)`}>
        <text 
          x="0" 
          y="2" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fill={color} 
          style={{ 
            fontSize: "7.5px", 
            fontWeight: "bold",
            paintOrder: "stroke", 
            stroke: "#000000", 
            strokeWidth: "2.5px"
          }}
        >
          {label}
        </text>
      </g>
    </g>
  );
};

export const renderEarthSymbol = (startX: number, endX: number, y: number, scale: number) => {
  if (startX >= endX) return null;
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