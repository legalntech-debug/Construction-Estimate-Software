import React from "react";
import { SectionCutDef, normalizeLook } from "../engine/sectionEngine";

interface Props {
  cut: SectionCutDef;
  posOuterFt: number;                 // distance from outer LEFT (VERTICAL cut) / outer TOP (HORIZONTAL cut)
  /** floor ka outer bounding box (px). Order of corner points se koi farak nahi padta. */
  box: { minX: number; maxX: number; minY: number; maxY: number };
  scale: number;
}

/**
 * Classic engineering section symbol:  thin chain line + short THICK end bars + thin view arrow + letter.
 *   VERTICAL   : line plan par upar -> neeche chalti hai (lambi / longitudinal section)
 *   HORIZONTAL : line baayen -> daayen chalti hai (aadhi / transverse section)
 */
export default function CadSectionCutMarker({ cut, posOuterFt, box, scale }: Props) {
  const look = normalizeLook(cut.axis, cut.look);
  const vertical = cut.axis === "VERTICAL";
  const color = cut.color || "#16a34a";
  const over = 6 * scale;                    // line building se kitni bahar tak
  const bar = 2.6 * scale;                   // thick end bar ki length (cut line ki direction me)
  const stem = 5 * scale;                    // arrow stem (view direction me)
  const dir = look === "LEFT" ? { x: -1, y: 0 } : look === "RIGHT" ? { x: 1, y: 0 } : look === "UP" ? { x: 0, y: -1 } : { x: 0, y: 1 };
  // cut line ki unit direction
  const u = vertical ? { x: 0, y: 1 } : { x: 1, y: 0 };

  const a = vertical
    ? { x: box.minX + posOuterFt * scale, y: box.minY - over }
    : { x: box.minX - over, y: box.minY + posOuterFt * scale };
  const b = vertical
    ? { x: a.x, y: box.maxY + over }
    : { x: box.maxX + over, y: a.y };

  const end = (pt: { x: number; y: number }, sign: 1 | -1, key: string) => {
    // thick bar: pt se line ke andar ki taraf
    const bar0 = pt;
    const bar1 = { x: pt.x + u.x * bar * sign, y: pt.y + u.y * bar * sign };
    const tip = { x: pt.x + dir.x * stem, y: pt.y + dir.y * stem };
    const ah = 1.15 * scale;                                  // arrow head half-width
    const hl = 2.2 * scale;                                   // arrow head length
    const back = { x: tip.x - dir.x * hl, y: tip.y - dir.y * hl };
    const nx = -dir.y, ny = dir.x;
    const head = `${tip.x},${tip.y} ${back.x + nx * ah},${back.y + ny * ah} ${back.x - nx * ah},${back.y - ny * ah}`;
    const lx = tip.x + dir.x * 6, ly = tip.y + dir.y * 6;
    return (
      <g key={key}>
        <line x1={bar0.x} y1={bar0.y} x2={bar1.x} y2={bar1.y} stroke={color} strokeWidth="2.6" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
        <line x1={pt.x} y1={pt.y} x2={back.x} y2={back.y} stroke={color} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <polygon points={head} fill={color} stroke="none" />
        <text x={lx} y={ly} fill={color} fontSize="8" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial, sans-serif">
          {cut.id}
        </text>
      </g>
    );
  };

  return (
    <g id={`section-cut-${cut.id}`} data-axis={cut.axis} data-pos-ft={posOuterFt.toFixed(2)} pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="0.7" strokeDasharray="9 2.5 1.5 2.5" vectorEffect="non-scaling-stroke" />
      {end(a, 1, "a")}
      {end(b, -1, "b")}
    </g>
  );
}
