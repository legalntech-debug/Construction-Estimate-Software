import React from "react";
import { SectionCutDef, normalizeLook } from "../engine/sectionEngine";

interface Props {
  cut: SectionCutDef;
  posOuterFt: number;                 // distance from outer LEFT (vertical cut) / outer TOP (horizontal cut)
  p0: { x: number; y: number };       // outer top-left of this floor (px)
  p1: { x: number; y: number };       // outer top-right
  p3: { x: number; y: number };       // outer bottom-left
  scale: number;
}

/** Engineering section-cut symbol: chain line + thick end bars + view arrows + letters (A ... A). */
export default function CadSectionCutMarker({ cut, posOuterFt, p0, p1, p3, scale }: Props) {
  const look = normalizeLook(cut.axis, cut.look);
  const vertical = cut.axis === "VERTICAL";
  const color = cut.color || "#16a34a";
  const m = 7 * scale;        // how far the line runs past the building
  const stem = 7 * scale;     // length of the arrow stem
  const dir = look === "LEFT" ? { x: -1, y: 0 } : look === "RIGHT" ? { x: 1, y: 0 } : look === "UP" ? { x: 0, y: -1 } : { x: 0, y: 1 };

  const W = Math.abs(p1.x - p0.x);
  const H = Math.abs(p3.y - p0.y);
  const a = vertical
    ? { x: p0.x + posOuterFt * scale, y: p0.y - m }
    : { x: p0.x - m, y: p0.y + posOuterFt * scale };
  const b = vertical
    ? { x: a.x, y: p0.y + H + m }
    : { x: p0.x + W + m, y: a.y };

  const arrow = (pt: { x: number; y: number }, key: string) => {
    const tip = { x: pt.x + dir.x * stem, y: pt.y + dir.y * stem };
    const ah = 3.2 * scale * 0.55;
    const back = { x: tip.x - dir.x * ah * 1.6, y: tip.y - dir.y * ah * 1.6 };
    const nx = -dir.y, ny = dir.x;
    const pts = `${tip.x},${tip.y} ${back.x + nx * ah},${back.y + ny * ah} ${back.x - nx * ah},${back.y - ny * ah}`;
    const lx = tip.x + dir.x * 7;
    const ly = tip.y + dir.y * 7;
    return (
      <g key={key}>
        <line x1={pt.x} y1={pt.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth="2.2" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
        <polygon points={pts} fill={color} stroke={color} strokeWidth="0.5" />
        <text x={lx} y={ly} fill={color} fontSize="11" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
          {cut.id}
        </text>
      </g>
    );
  };

  return (
    <g id={`section-cut-${cut.id}`} pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="1.1" strokeDasharray="10 3 2 3" vectorEffect="non-scaling-stroke" />
      {arrow(a, "a")}
      {arrow(b, "b")}
    </g>
  );
}
