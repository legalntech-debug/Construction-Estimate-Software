import React from "react";
import { formatDim, renderEarthSymbol } from "./CadDimUtils";
import { Levels } from "../engine/sectionEngine";

export const INK = "#000000";
export const GREY = "#555555";
export const GLASS = "#e8eef5";

/** Hatch / fill patterns used by section + elevation drawings (ids are unique to avoid clashes). */
export function DrawingDefs() {
  return (
    <defs>
      <pattern id="secRcc" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="#dfe3e8" />
        <line x1="0" y1="0" x2="0" y2="5" stroke={INK} strokeWidth="0.6" />
        <line x1="0" y1="2.5" x2="5" y2="2.5" stroke={INK} strokeWidth="0.3" />
      </pattern>
      <pattern id="secDots" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.2" cy="1.2" r="0.45" fill={INK} />
        <circle cx="3.7" cy="3.7" r="0.45" fill={INK} />
      </pattern>
      <pattern id="secEarth" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#6b7280" strokeWidth="0.5" />
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

/** dashed level lines + call-out boxes (right side of a drawing). Boxes are pushed apart so they never overlap. */
export function LevelMarkers({
  tags, plinthFt, xEdge, scale, unit,
}: { tags: LevelTag[]; plinthFt: number; xEdge: number; scale: number; unit?: "FEET" | "METERS" }) {
  const boxW = 112, boxH = 14, xBox = xEdge + 8 * scale;
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
            <rect x={xBox} y={by - boxH / 2} width={boxW} height={boxH} fill="#fff" stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" rx="2" />
            <text x={xBox + 3} y={by} fill={INK} fontSize="5.6" fontWeight="bold" dominantBaseline="middle">{t.label}</text>
            <text x={xBox + boxW - 3} y={by} fill="#1e40af" fontSize="5.6" fontWeight="bold" textAnchor="end" dominantBaseline="middle">
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
      <text x={xb + 18} y={y + 2} fill={INK} fontSize="5.6" fontWeight="bold">G.L.</text>
    </g>
  );
}
