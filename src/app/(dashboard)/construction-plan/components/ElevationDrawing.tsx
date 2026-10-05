/* =========================================================
   ELEVATION DRAWING (React SVG renderer)
   Draws buildElevationModel() output like an architect's facade:
   plinth + steps, slab bands, windows with frames/mullions,
   doors, parking gate, balcony rail, parapet, tower, G.L.
   Same ctx as SectionDrawing -> elevation always matches plan.
========================================================= */
import React, { useMemo } from "react";
import { WALL_T, buildElevationModel, buildLevels, type ElevationSide, type SectionContext } from "../engine/sectionEngine";
import type { EmbedPlacement } from "./SectionDrawing";

const INK = "#111";
const THIN = "#444";
const plain = (ft: number) => { const t = Math.round(Math.abs(ft) * 12); return `${Math.floor(t / 12)}'-${t % 12}"`; };

export default function ElevationDrawing({ ctx, side = "FRONT", scale = 14, className, embedded }: { ctx: SectionContext; side?: ElevationSide; scale?: number; className?: string; embedded?: EmbedPlacement }) {
  const { m, lv } = useMemo(() => ({ m: buildElevationModel(ctx, side), lv: buildLevels(ctx) }), [ctx, side]);
  const S = scale, L = m.lengthA, plinth = lv.plinthFt;
  const zTop = (m.tower && lv.towerTop ? lv.towerTop : lv.parapetTop) + 2.5;
  const zBot = -plinth - 1.2;
  const leftM = 7 * S, rightM = 4 * S, topM = 2.6 * S, botM = 4.2 * S;
  const W = leftM + L * S + rightM, H = topM + (zTop - zBot) * S + botM;
  const x = (a: number) => leftM + a * S;
  const y = (z: number) => topM + (zTop - z) * S;
  const roofTop = lv.roofSlabTop;
  const f0 = m.floors[0];
  const a0 = f0 ? f0.a0 : 0, a1 = f0 ? f0.a1 : L;

  const els: React.ReactNode[] = [];
  m.floors.forEach((f, fi) => {
    const lf = lv.floors[fi];
    // wall face + slab band
    els.push(<rect key={`wall${fi}`} x={x(f.a0)} y={y(lf.clearTop)} width={(f.a1 - f.a0) * S} height={lf.heightFt * S} fill="#fafafa" stroke={INK} strokeWidth={1} />);
    els.push(<rect key={`slab${fi}`} x={x(f.a0) - 2} y={y(lf.slabTop)} width={(f.a1 - f.a0) * S + 4} height={lf.slabFt * S} fill={INK} />);
    // opening elements
    f.openings.forEach((o, k) => {
      const ox = x(o.a0), ow = (o.a1 - o.a0) * S, oy = y(o.z1), oh = (o.z1 - o.z0) * S;
      if (o.kind === "B") {
        // balcony: slab projection + rail with balusters
        const ry = y(o.z0 + 3);
        els.push(<rect key={`bs${fi}_${k}`} x={ox - 3} y={y(o.z0)} width={ow + 6} height={4} fill={INK} />);
        els.push(<rect key={`br${fi}_${k}`} x={ox} y={ry} width={ow} height={3 * S} fill="none" stroke={INK} strokeWidth={1} />);
        for (let b = ox + 6; b < ox + ow - 2; b += 6) els.push(<line key={`bb${fi}_${k}_${b}`} x1={b} y1={ry} x2={b} y2={y(o.z0)} stroke={THIN} strokeWidth={0.6} />);
        return;
      }
      if (o.kind === "D" || o.kind === "G") {
        els.push(<rect key={`d${fi}_${k}`} x={ox} y={oy} width={ow} height={oh} fill={o.kind === "G" ? "#e5e5e5" : "#fff"} stroke={INK} strokeWidth={1} />);
        if (o.kind === "G") for (let g = ox + 5; g < ox + ow; g += 5) els.push(<line key={`gl${fi}_${k}_${g}`} x1={g} y1={oy} x2={g} y2={oy + oh} stroke={THIN} strokeWidth={0.5} />);
        else els.push(<rect key={`dp${fi}_${k}`} x={ox + 3} y={oy + 3} width={Math.max(0, ow - 6)} height={Math.max(0, oh - 6)} fill="none" stroke={THIN} strokeWidth={0.6} />);
        return;
      }
      els.push(<rect key={`w${fi}_${k}`} x={ox} y={oy} width={ow} height={oh} fill="#dbe7f3" stroke={INK} strokeWidth={1.1} />);
      els.push(<rect key={`wl${fi}_${k}`} x={ox - 2} y={oy + oh} width={ow + 4} height={2.5} fill={INK} />);   // sill
      if (o.kind === "W") {
        const panes = ow > 3.2 * S ? 3 : 2;
        for (let p = 1; p < panes; p++) els.push(<line key={`wm${fi}_${k}_${p}`} x1={ox + (ow * p) / panes} y1={oy} x2={ox + (ow * p) / panes} y2={oy + oh} stroke={INK} strokeWidth={0.8} />);
        els.push(<line key={`wh${fi}_${k}`} x1={ox} y1={oy + oh * 0.35} x2={ox + ow} y2={oy + oh * 0.35} stroke={INK} strokeWidth={0.6} />);
      } else for (let g = oy + 3; g < oy + oh; g += 3) els.push(<line key={`v${fi}_${k}_${g}`} x1={ox} y1={g} x2={ox + ow} y2={g} stroke={THIN} strokeWidth={0.5} />);   // vent louvres
    });
  });

  // steps at entrances (ground floor)
  const steps = (f0?.steps || []).map((s, i) => {
    const n = Math.max(1, Math.round(plinth / 0.5));
    return <g key={`stp${i}`}>{Array.from({ length: n }).map((_, k) => (
      <rect key={k} x={x(s.a0) - k * 3} y={y(-plinth + ((k + 1) * plinth) / n) - 0.5} width={(s.a1 - s.a0) * S + k * 6} height={(plinth / n) * S} fill="#fff" stroke={INK} strokeWidth={0.8} />
    ))}</g>;
  });

  const parapet = (
    <g>
      <rect x={x(a0)} y={y(lv.parapetTop)} width={(a1 - a0) * S} height={(lv.parapetTop - roofTop) * S} fill="#fff" stroke={INK} strokeWidth={1.2} />
      <rect x={x(a0) - 3} y={y(lv.parapetTop)} width={(a1 - a0) * S + 6} height={4} fill={INK} />
      <line x1={x(a0)} y1={y(roofTop + 0.6)} x2={x(a1)} y2={y(roofTop + 0.6)} stroke={THIN} strokeWidth={0.6} />
    </g>
  );

  const tower = m.tower && lv.towerTop ? (
    <g>
      <rect x={x(m.tower.a0)} y={y(lv.towerTop)} width={(m.tower.a1 - m.tower.a0) * S} height={(lv.towerTop - roofTop) * S} fill="#fff" stroke={INK} strokeWidth={1.2} />
      <rect x={x(m.tower.a0) - 3} y={y(lv.towerTop)} width={(m.tower.a1 - m.tower.a0) * S + 6} height={5} fill={INK} />
    </g>
  ) : null;

  const lvls: [number, string][] = [[-plinth, "G.L."], [0, "PLINTH"], ...lv.floors.slice(1).map((f, i) => [f.ffl, `FLOOR ${i + 1}`] as [number, string]), [roofTop, "ROOF"], [lv.parapetTop, "PARAPET"]];
  const gl = y(-plinth);

  const k = embedded ? embedded.pxPerFt / S : 1;
  const svgSizing: React.SVGProps<SVGSVGElement> = embedded
    ? { x: embedded.originX - leftM * k, y: embedded.originY - y(0) * k, width: W * k, height: H * k, style: { overflow: "visible" } }
    : { width: "100%", style: { background: "#fff", maxHeight: "100%" } };

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} {...svgSizing} xmlns="http://www.w3.org/2000/svg">
      {/* overall width dimension */}
      <g stroke={INK} strokeWidth={0.8}>
        <line x1={x(a0)} y1={topM * 0.45} x2={x(a1)} y2={topM * 0.45} />
        <line x1={x(a0)} y1={topM * 0.45 - 5} x2={x(a0)} y2={topM * 0.45 + 5} /><line x1={x(a1)} y1={topM * 0.45 - 5} x2={x(a1)} y2={topM * 0.45 + 5} />
      </g>
      <rect x={(x(a0) + x(a1)) / 2 - 32} y={topM * 0.45 - 9} width={64} height={18} fill="#fff" stroke={INK} strokeWidth={0.8} />
      <text x={(x(a0) + x(a1)) / 2} y={topM * 0.45 + 4} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fontFamily: "Arial, sans-serif" }}>{plain(a1 - a0)}</text>

      {/* plinth */}
      <rect x={x(a0) - 2} y={y(0)} width={(a1 - a0) * S + 4} height={plinth * S} fill="#eee" stroke={INK} strokeWidth={1.2} />
      {steps}
      {els}
      {parapet}
      {tower}

      {/* ground line */}
      <line x1={x(a0) - 3 * S} y1={gl} x2={x(a1) + 3 * S} y2={gl} stroke={INK} strokeWidth={1.4} />
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={`h${i}`} x1={x(a0) - 3 * S + i * 8} y1={gl} x2={x(a0) - 3 * S + i * 8 - 6} y2={gl + 6} stroke={THIN} strokeWidth={0.7} />)}
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={`hr${i}`} x1={x(a1) + 3 * S - i * 8} y1={gl} x2={x(a1) + 3 * S - i * 8 - 6} y2={gl + 6} stroke={THIN} strokeWidth={0.7} />)}

      {/* level ticks (left) */}
      {lvls.map(([z, t], i) => (
        <g key={`lv${i}`} style={{ fontFamily: "Arial, sans-serif" }}>
          <line x1={x(a0) - 2.6 * S} y1={y(z)} x2={x(a0) - 0.4 * S} y2={y(z)} stroke={THIN} strokeWidth={0.6} strokeDasharray="3 2" />
          <text x={x(a0) - 2.7 * S} y={y(z) - 2} textAnchor="end" fontSize={8} fontWeight={700}>{t}</text>
        </g>
      ))}

      <text x={(x(a0) + x(a1)) / 2} y={H - 1.6 * S} textAnchor="middle" fontSize={17} fontWeight={800} style={{ fontFamily: "Arial, sans-serif" }}>{m.title}</text>
      <text x={(x(a0) + x(a1)) / 2} y={H - 0.6 * S} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={THIN} style={{ fontFamily: "Arial, sans-serif" }}>{`(SCALE: 1 FT = ${S} PX · WALL ${Math.round(WALL_T * 12)}")`}</text>
    </svg>
  );
}
