import React from "react";
import { formatDim, renderEarthSymbol } from "./CadDimUtils";
import { Levels } from "../engine/sectionEngine";

/**
 * Shared drawing kit for Section + Elevation.
 * RULE: no tinted background fills anywhere. A drawing is black line-work on the sheet:
 *   solid black = cut RCC (slab / beam / stair), hatch lines = masonry / soil, thin lines = everything beyond.
 */
export const INK = "#000000";
export const GREY = "#4b5563";
export const FS = 6.2;          // base annotation size (px at CAD scale)

export function DrawingDefs() {
  return (
    <defs>
      <pattern id="secWall" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="4" stroke={INK} strokeWidth="0.6" />
      </pattern>
      <pattern id="secDots" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.2" cy="1.2" r="0.45" fill={INK} />
        <circle cx="3.7" cy="3.7" r="0.45" fill={INK} />
      </pattern>
      <pattern id="secEarth" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke={GREY} strokeWidth="0.5" />
      </pattern>
    </defs>
  );
}

/** level text relative to ground level, e.g. +1'-6" */
export const fmtLevel = (zFromGL: number, scale: number, unit?: "FEET" | "METERS") => {
  const sign = zFromGL < -0.001 ? "-" : zFromGL > 0.001 ? "+" : "±";
  return `${sign}${formatDim(Math.abs(zFromGL) * scale, scale, unit)}`;
};

export interface LevelTag { label: string; z: number }

export function levelTagsFrom(levels: Levels, withTower = true): LevelTag[] {
  const tags: LevelTag[] = [{ label: "GROUND LEVEL", z: -levels.plinthFt }];
  levels.floors.forEach((f, i) => {
    tags.push({ label: i === 0 ? `${f.name} (PLINTH)` : f.name, z: f.ffl });
  });
  tags.push({ label: "ROOF SLAB TOP", z: levels.roofSlabTop });
  tags.push({ label: "PARAPET TOP", z: levels.parapetTop });
  if (withTower && levels.towerTop !== undefined) tags.push({ label: "TOWER TOP", z: levels.towerTop });
  return tags;
}

/** dashed level lines + call-out boxes (right side). Boxes are pushed apart so they never overlap. */
export function LevelMarkers({
  tags, plinthFt, xEdge, scale, unit,
}: { tags: LevelTag[]; plinthFt: number; xEdge: number; scale: number; unit?: "FEET" | "METERS" }) {
  const boxW = 118, boxH = 14, xBox = xEdge + 34;
  const sorted = [...tags].sort((a, b) => b.z - a.z);            // top first
  const ys: number[] = [];
  sorted.forEach((t, i) => {
    const y = -t.z * scale;
    ys.push(i === 0 ? y : Math.max(y, ys[i - 1] + boxH + 2));
  });
  return (
    <g>
      {sorted.map((t, i) => {
        const y = -t.z * scale, by = ys[i];
        return (
          <g key={`lvl-${i}`}>
            <line x1={xEdge} y1={y} x2={xBox} y2={by} stroke={INK} strokeWidth="0.6" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
            <polygon points={`${xEdge},${y} ${xEdge + 3.5},${y - 2.2} ${xEdge + 3.5},${y + 2.2}`} fill={INK} />
            <rect x={xBox} y={by - boxH / 2} width={boxW} height={boxH} fill="#ffffff" stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" rx="2" />
            <text x={xBox + 4} y={by} fill={INK} fontSize={FS} fontWeight="bold" dominantBaseline="middle">{t.label}</text>
            <text x={xBox + boxW - 4} y={by} fill="#1e40af" fontSize={FS} fontWeight="bold" textAnchor="end" dominantBaseline="middle">
              {fmtLevel(t.z + plinthFt, scale, unit)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** natural ground line with earth hatch + earth symbols at both ends */
export function GroundLine({ xa, xb, plinthFt, scale }: { xa: number; xb: number; plinthFt: number; scale: number }) {
  const y = plinthFt * scale;
  return (
    <g>
      <rect x={xa - 15} y={y} width={xb - xa + 30} height={1.4 * scale} fill="url(#secEarth)" stroke="none" />
      <line x1={xa - 15} y1={y} x2={xb + 15} y2={y} stroke={INK} strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
      {renderEarthSymbol(xa - 15, xa, y, scale)}
      {renderEarthSymbol(xb, xb + 15, y, scale)}
    </g>
  );
}

/** Plinth height is only ~8px tall on sheet, so it is written horizontally to the left of the dimension chain. */
export function PlinthDim({ x, y0, y1, label, scale }: { x: number; y0: number; y1: number; label: string; scale: number }) {
  const dx = x - 2 * scale, yMid = (y0 + y1) / 2;
  return (
    <g>
      <line x1={dx} y1={y0} x2={dx} y2={y1} stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      <line x1={dx - 3} y1={y0} x2={dx + 3} y2={y0} stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      <line x1={dx - 3} y1={y1} x2={dx + 3} y2={y1} stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      <text x={dx - 5} y={yMid} fill={INK} fontSize={FS} fontWeight="bold" textAnchor="end" dominantBaseline="middle"
        style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: "2px" }}>{label}</text>
    </g>
  );
}

/** simple horizontal dimension (used for MOS / setbacks under the ground line) */
export function HDim({ xa, xb, y, label }: { xa: number; xb: number; y: number; label: string }) {
  const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
  if (hi - lo < 4) return null;
  const fits = hi - lo > label.length * FS * 0.62 + 8;
  return (
    <g>
      <line x1={lo} y1={y} x2={hi} y2={y} stroke={INK} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      <polygon points={`${lo},${y} ${lo + 4},${y - 1.8} ${lo + 4},${y + 1.8}`} fill={INK} />
      <polygon points={`${hi},${y} ${hi - 4},${y - 1.8} ${hi - 4},${y + 1.8}`} fill={INK} />
      <line x1={lo} y1={y - 3} x2={lo} y2={y + 3} stroke={INK} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      <line x1={hi} y1={y - 3} x2={hi} y2={y + 3} stroke={INK} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      <text x={(lo + hi) / 2} y={fits ? y - 2.5 : y + 9} fill={INK} fontSize={FS} fontWeight="bold" textAnchor="middle"
        style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: "2px" }}>{label}</text>
    </g>
  );
}
