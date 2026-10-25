"use client";

import React from "react";

/* =========================================================
   Small drawing helpers shared by the subdivision drawings.
   Pure black-and-white, inline SVG attributes only (no CSS
   classes) so the drawing prints and exports to PDF cleanly.
========================================================= */

export type Unit = "FEET" | "METERS";

export const INK = "#000000";

// White outline behind text so it stays readable over lines and hatching
export const HALO: React.CSSProperties = { paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "1.6px" };

/** 10.5 ft -> 10'-6"   |   3.25 m -> 3.25m */
export const fmtDim = (v: number, unit: Unit) => {
  if (unit === "METERS") return `${v.toFixed(2)}m`;
  const totalInches = Math.round(v * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'-${inches}"`;
};

export const areaUnitLabel = (unit: Unit) => (unit === "METERS" ? "SQ.M" : "SQ.FT");

interface DimHProps {
  x1: number;
  x2: number;
  y: number;
  text: string;
  size: number;
  above?: boolean;
}

/** Horizontal dimension line with arrow heads, end ticks and centred text. */
export function DimH({ x1, x2, y, text, size, above = true }: DimHProps) {
  const mx = (x1 + x2) / 2;
  const ty = above ? y - size * 0.4 : y + size * 1.05;
  return (
    <g stroke={INK} strokeWidth={0.5} fill={INK} fontFamily="Arial, Helvetica, sans-serif">
      <line x1={x1} y1={y} x2={x2} y2={y} fill="none" />
      <line x1={x1} y1={y - 2.4} x2={x1} y2={y + 2.4} fill="none" />
      <line x1={x2} y1={y - 2.4} x2={x2} y2={y + 2.4} fill="none" />
      <polygon points={`${x1},${y} ${x1 + 3.2},${y - 1.1} ${x1 + 3.2},${y + 1.1}`} stroke="none" />
      <polygon points={`${x2},${y} ${x2 - 3.2},${y - 1.1} ${x2 - 3.2},${y + 1.1}`} stroke="none" />
      <text x={mx} y={ty} textAnchor="middle" fontSize={size} fontWeight={700} fill={INK} style={HALO}>
        {text}
      </text>
    </g>
  );
}

interface DimVProps {
  x: number;
  y1: number;
  y2: number;
  text: string;
  size: number;
  textSide?: "left" | "right";
}

/** Vertical dimension line with arrow heads, end ticks and rotated text. */
export function DimV({ x, y1, y2, text, size, textSide = "right" }: DimVProps) {
  const my = (y1 + y2) / 2;
  const dy = textSide === "right" ? size * 1.05 : -size * 0.4;
  return (
    <g stroke={INK} strokeWidth={0.5} fill={INK} fontFamily="Arial, Helvetica, sans-serif">
      <line x1={x} y1={y1} x2={x} y2={y2} fill="none" />
      <line x1={x - 2.4} y1={y1} x2={x + 2.4} y2={y1} fill="none" />
      <line x1={x - 2.4} y1={y2} x2={x + 2.4} y2={y2} fill="none" />
      <polygon points={`${x},${y1} ${x - 1.1},${y1 + 3.2} ${x + 1.1},${y1 + 3.2}`} stroke="none" />
      <polygon points={`${x},${y2} ${x - 1.1},${y2 - 3.2} ${x + 1.1},${y2 - 3.2}`} stroke="none" />
      <text
        x={x}
        y={my}
        dy={dy}
        transform={`rotate(-90 ${x} ${my})`}
        textAnchor="middle"
        fontSize={size}
        fontWeight={700}
        fill={INK}
        style={HALO}
      >
        {text}
      </text>
    </g>
  );
}
