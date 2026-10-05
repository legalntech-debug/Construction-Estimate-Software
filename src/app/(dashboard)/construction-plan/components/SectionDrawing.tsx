/* =========================================================
   SECTION DRAWING (React SVG renderer)
   ---------------------------------------------------------
   Draws the SectionModel from sectionEngine.ts like a 2D
   engineering section (cut walls / slabs / stair in poche,
   beyond-faces thin, levels + dimensions, labels that dodge
   the stair). Works for ANY plot size / floors / stair shape:
   scale is auto-fitted through the SVG viewBox.

   Usage:
     const ctx = buildSectionContext(processedFloors, floorData, floorRooms, outerW, outerL);
     <SectionDrawing ctx={ctx} cut={{ id:"A", axis:"VERTICAL", positionFt:"AUTO", look:"LEFT" }} />
========================================================= */
import React, { useMemo } from "react";
import {
  WALL_T, buildLevels, buildSectionModel,
  type SectionContext, type SectionCutDef, type SectionFloor, type SecPoly,
} from "../engine/sectionEngine";

const INK = "#111";
const THIN = "#444";
const S_DEFAULT = 14; // px per foot (viewBox units, final size is responsive)

/** 12.5 -> 12'-6" */
export const fmtFtIn = (ft: number) => {
  const sign = ft < -0.001 ? "-" : ft > 0.001 ? "+" : "±";
  const tot = Math.round(Math.abs(ft) * 12);
  return `${sign}${Math.floor(tot / 12)}'-${tot % 12}"`;
};
const plain = (ft: number) => {
  const tot = Math.round(Math.abs(ft) * 12);
  return `${Math.floor(tot / 12)}'-${tot % 12}"`;
};

/** remove [a,b] holes from [lo,hi] -> segments */
function subtract(lo: number, hi: number, holes: [number, number][]): [number, number][] {
  const hs = holes.filter((h) => h[1] > lo && h[0] < hi).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = lo;
  for (const [a, b] of hs) { if (a > cur) out.push([cur, Math.min(a, hi)]); cur = Math.max(cur, b); }
  if (cur < hi) out.push([cur, hi]);
  return out.filter((s) => s[1] - s[0] > 0.01);
}

export interface EmbedPlacement {
  /** parent-SVG coords where the building's LEFT outer face (x) and the FFL / plinth-top line (y) must land */
  originX: number; originY: number;
  /** parent px per foot (the CAD `scale`) */
  pxPerFt: number;
}

export interface SectionDrawingProps {
  /** when set, draws as a nested <svg> inside the CAD canvas (old ground line / boundary walls stay owned by the CAD view) */
  embedded?: EmbedPlacement;
  ctx: SectionContext;
  cut: SectionCutDef;
  scale?: number;           // px per ft inside the viewBox
  showLevels?: boolean;
  showRoomNames?: boolean;
  className?: string;
}

export default function SectionDrawing({ ctx, cut, scale = S_DEFAULT, showLevels = true, showRoomNames = true, className, embedded }: SectionDrawingProps) {
  const { model, lv } = useMemo(() => ({ model: buildSectionModel(ctx, cut), lv: buildLevels(ctx) }), [ctx, cut]);
  const S = scale;
  const L = model.lengthV;
  const plinth = lv.plinthFt;
  const zTopMost = (lv.towerTop && model.tower ? lv.towerTop : lv.parapetTop) + 3.5;
  const zBottom = -plinth - 4.5;

  // frame (px)
  const leftM = 6 * S, rightM = showLevels ? 17 * S : 3 * S, topM = 1 * S, botM = 5.5 * S;
  const W = leftM + L * S + rightM;
  const H = topM + (zTopMost - zBottom) * S + botM;
  const sx = (v: number) => leftM + (model.flip ? L - v : v) * S;
  const sy = (z: number) => topM + (zTopMost - z) * S;
  const rectV = (v0: number, v1: number) => { const a = sx(v0), b = sx(v1); return { x: Math.min(a, b), w: Math.abs(b - a) }; };

  const Poche = ({ v0, v1, z0, z1, fill = INK }: { v0: number; v1: number; z0: number; z1: number; fill?: string }) => {
    const r = rectV(v0, v1);
    return <rect x={r.x} y={sy(z1)} width={r.w} height={Math.max(0, (z1 - z0) * S)} fill={fill} />;
  };

  const poly = (p: SecPoly, key: string | number) => {
    const pts = p.pts.map(([v, z]) => `${sx(v).toFixed(2)},${sy(z).toFixed(2)}`).join(" ");
    return p.kind === "POCHE"
      ? <polygon key={key} points={pts} fill={INK} stroke={INK} strokeWidth={0.6} />
      : <polygon key={key} points={pts} fill="none" stroke={THIN} strokeWidth={0.7} strokeLinejoin="round" />;
  };

  /* ---------- per floor ---------- */
  const floorEls = model.floors.map((f: SectionFloor, fi) => {
    const clearH = f.heightFt;
    const els: React.ReactNode[] = [];

    // beyond faces (what is seen through the cut) - very light
    f.faces.forEach((fc, i) => {
      const r = rectV(fc.v0, fc.v1);
      els.push(<rect key={`fb${i}`} x={r.x} y={sy(f.ffl + clearH)} width={r.w} height={clearH * S} fill="#f6f7f9" />);
      fc.openings.forEach((o, k) => {
        const rr = rectV(o.a0, o.a1);
        const y = sy(f.ffl + o.z1), h = (o.z1 - o.z0) * S;
        if (o.kind === "D") els.push(<rect key={`fo${i}_${k}`} x={rr.x} y={y} width={rr.w} height={h} fill="#fff" stroke={THIN} strokeWidth={0.7} />);
        else {
          els.push(<rect key={`fo${i}_${k}`} x={rr.x} y={y} width={rr.w} height={h} fill="#dfe9f5" stroke={THIN} strokeWidth={0.7} />);
          els.push(<line key={`fm${i}_${k}`} x1={rr.x + rr.w / 2} y1={y} x2={rr.x + rr.w / 2} y2={y + h} stroke={THIN} strokeWidth={0.5} />);
          if (o.kind === "W") els.push(<line key={`fh${i}_${k}`} x1={rr.x} y1={y + h / 2} x2={rr.x + rr.w} y2={y + h / 2} stroke={THIN} strokeWidth={0.5} />);
        }
      });
    });

    // cut walls (with door / window gaps)
    f.walls.forEach((w, i) => {
      const gaps = f.walls[i].gaps.map((g) => [f.ffl + g.z0, f.ffl + g.z1] as [number, number]);
      subtract(f.ffl, f.clearTop, gaps).forEach(([z0, z1], k) => els.push(<Poche key={`w${i}_${k}`} v0={w.v0} v1={w.v1} z0={z0} z1={z1} />));
      w.gaps.forEach((g, k) => {
        if (g.kind !== "W") return;
        const r = rectV(w.v0, w.v1);
        els.push(<rect key={`g${i}_${k}`} x={r.x} y={sy(f.ffl + g.z1)} width={r.w} height={(g.z1 - g.z0) * S} fill="#fff" stroke={INK} strokeWidth={0.6} />);
      });
    });

    // slab (ceiling slab of this floor = floor slab of next) minus stair openings
    subtract(0, f.outerLen, f.holes).forEach(([a, b], k) =>
      els.push(<Poche key={`s${k}`} v0={a} v1={b} z0={f.clearTop} z1={f.slabTop} />));

    // stairs
    f.stairs.forEach((st, k) => st.polys.forEach((p, j) => els.push(poly(p, `st${k}_${j}`))));

    // room names - dodge stair bounding boxes, split to 2 lines, skip when it cannot fit
    if (showRoomNames) {
      const stairSpans = f.stairs.flatMap((st) => {
        const vs = st.polys.flatMap((p) => p.pts.map((q) => q[0]));
        return vs.length ? [[Math.min(...vs) - 0.2, Math.max(...vs) + 0.2] as [number, number]] : [];
      });
      const fs = Math.max(6.5, Math.min(11, S * 0.62));
      const zLabel = f.ffl + Math.max(clearH - 1.1, clearH * 0.8);
      f.rooms.forEach((r, i) => {
        const free = subtract(r.v0 + WALL_T / 2, r.v1 - WALL_T / 2, stairSpans).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
        if (!free) return;
        const availPx = (free[1] - free[0]) * S - 4;
        const name = r.name.replace(/\s*\(.*\)$/, "");
        const w = (t: string) => t.length * fs * 0.62;
        let lines = [name];
        if (w(name) > availPx) {
          const words = name.split(" ");
          if (words.length < 2) return;
          let best = 1, diff = 1e9;
          for (let k = 1; k < words.length; k++) { const d = Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length); if (d < diff) { diff = d; best = k; } }
          lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
          if (Math.max(...lines.map(w)) > availPx) return;
        }
        const cx = sx((free[0] + free[1]) / 2);
        lines.forEach((t, k) => els.push(
          <text key={`rn${i}_${k}`} x={cx} y={sy(zLabel) + k * fs * 1.15} fontSize={fs} fontWeight={700} textAnchor="middle" fill={INK} style={{ fontFamily: "Arial, sans-serif" }}>{t}</text>));
      });
      f.stairs.forEach((st, k) => {
        if (!st.anchor || st.relation !== "CUT") return;
        els.push(<text key={`sl${k}`} x={sx(st.anchor[0])} y={sy(st.anchor[1])} fontSize={Math.max(6, fs * 0.8)} textAnchor="middle" fill={THIN} style={{ fontFamily: "Arial, sans-serif" }}>{st.label}</text>);
      });
    }
    return <g key={`f${fi}`}>{els}</g>;
  });

  /* ---------- ground, plinth, footings ---------- */
  const gl = sy(-plinth);
  const footings: React.ReactNode[] = [];
  const ground = model.floors[0];
  if (ground) ground.walls.forEach((w, i) => {
    const r = rectV(w.v0, w.v1), cx = r.x + r.w / 2, fwid = (w.kind === "E" ? 3 : 2.5) * S;
    footings.push(<rect key={`col${i}`} x={r.x} y={sy(-plinth)} width={r.w} height={3 * S} fill={INK} />);
    footings.push(<rect key={`ft${i}`} x={cx - fwid / 2} y={sy(-plinth - 3)} width={fwid} height={0.9 * S} fill="url(#dots)" stroke={INK} strokeWidth={0.8} />);
  });

  /* ---------- roof parapet + tower ---------- */
  const lastF = model.floors[model.floors.length - 1];
  const roofTop = lastF?.slabTop ?? 0;
  const parapet = lastF && (
    <g>
      <Poche v0={0} v1={WALL_T} z0={roofTop} z1={lv.parapetTop} />
      <Poche v0={lastF.outerLen - WALL_T} v1={lastF.outerLen} z0={roofTop} z1={lv.parapetTop} />
    </g>
  );
  let towerEl: React.ReactNode = null;
  if (model.tower && lv.towerTop) {
    const t = model.tower, top = lv.towerTop;
    towerEl = t.relation === "CUT" ? (
      <g>
        <Poche v0={t.v0} v1={t.v0 + WALL_T} z0={roofTop} z1={top} />
        <Poche v0={t.v1 - WALL_T} v1={t.v1} z0={roofTop} z1={top} />
        <Poche v0={t.v0 - 0.3} v1={t.v1 + 0.3} z0={top - 0.5} z1={top} />
      </g>
    ) : (
      <g fill="none" stroke={THIN} strokeWidth={0.8} strokeDasharray="4 3">
        <rect x={rectV(t.v0, t.v1).x} y={sy(top)} width={rectV(t.v0, t.v1).w} height={(top - roofTop) * S} />
      </g>
    );
  }

  /* ---------- level markers ---------- */
  type Mk = { z: number; text: string };
  const marks: Mk[] = [{ z: -plinth, text: "GROUND LEVEL" }];
  model.floors.forEach((f, i) => marks.push({ z: f.ffl, text: i === 0 ? "GROUND FLOOR (PLINTH)" : `${f.name.replace(/ FLOOR$/i, "")} FLOOR` }));
  marks.push({ z: roofTop, text: "ROOF SLAB TOP" }, { z: lv.parapetTop, text: "PARAPET TOP" });
  if (model.tower && lv.towerTop) marks.push({ z: lv.towerTop, text: "TOWER TOP" });
  // de-clutter: keep >= 0.9 ft apart in px terms
  const sorted = marks.slice().sort((a, b) => a.z - b.z);
  const labelY: number[] = [];
  sorted.forEach((m, i) => { const y = sy(m.z); labelY[i] = i === 0 ? y : Math.min(y, labelY[i - 1] - 13); });
  const xr = sx(model.flip ? 0 : L) + (model.flip ? -0 : 0);
  const rightEdge = leftM + L * S;

  /* ---------- dimensions ---------- */
  const dimY = sy(zTopMost - 1.2);
  const title = model.title;
  const lookTxt = { LEFT: "LEFT", RIGHT: "RIGHT", UP: "BACK", DOWN: "FRONT" }[model.cut.look];
  const posTxt = `${plain(model.positionOuterFt)} FROM ${model.cut.axis === "VERTICAL" ? "LEFT" : "TOP"}`;
  void xr;

  const k = embedded ? embedded.pxPerFt / S : 1;
  const svgSizing: React.SVGProps<SVGSVGElement> = embedded
    ? { x: embedded.originX - leftM * k, y: embedded.originY - sy(0) * k, width: W * k, height: H * k, style: { overflow: "visible" } }
    : { width: "100%", style: { background: "#fff", maxHeight: "100%" } };

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} {...svgSizing} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.7" fill={INK} /><circle cx="4" cy="4" r="0.7" fill={INK} /></pattern>
        <pattern id="soil" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="#666" strokeWidth="0.7" /></pattern>
      </defs>

      {/* overall dimension */}
      <g stroke={INK} strokeWidth={0.8} fill="none">
        <line x1={leftM} y1={dimY} x2={leftM + L * S} y2={dimY} />
        <line x1={leftM} y1={dimY - 5} x2={leftM} y2={dimY + 5} />
        <line x1={leftM + L * S} y1={dimY - 5} x2={leftM + L * S} y2={dimY + 5} />
        <line x1={leftM} y1={dimY} x2={leftM} y2={sy(lv.parapetTop) - 2} strokeDasharray="2 3" strokeWidth={0.5} />
        <line x1={leftM + L * S} y1={dimY} x2={leftM + L * S} y2={sy(lv.parapetTop) - 2} strokeDasharray="2 3" strokeWidth={0.5} />
      </g>
      <rect x={leftM + (L * S) / 2 - 34} y={dimY - 10} width={68} height={20} fill="#fff" stroke={INK} strokeWidth={0.8} />
      <text x={leftM + (L * S) / 2} y={dimY + 4.5} textAnchor="middle" fontSize={12} fontWeight={700} style={{ fontFamily: "Arial, sans-serif" }}>{plain(L)}</text>

      {/* ground */}
      {!embedded && <rect x={leftM - 3 * S} y={gl} width={L * S + 6 * S} height={2.2 * S} fill="url(#soil)" opacity={0.55} />}
      {footings}
      <rect x={leftM} y={sy(0)} width={L * S} height={plinth * S} fill="url(#dots)" stroke={INK} strokeWidth={0.8} />
      {!embedded && <line x1={leftM - 3 * S} y1={gl} x2={leftM + L * S + 3 * S} y2={gl} stroke={INK} strokeWidth={1.2} />}
      {!embedded && <text x={leftM - 3 * S} y={gl - 3} fontSize={8} fontWeight={700} style={{ fontFamily: "Arial, sans-serif" }}>G.L.</text>}

      {floorEls}
      {parapet}
      {towerEl}

      {/* floor height chain (left) */}
      <g stroke={INK} strokeWidth={0.6} fill="none" style={{ fontFamily: "Arial, sans-serif" }}>
        {model.floors.map((f, i) => {
          const x = leftM - 1.6 * S, y0 = sy(f.ffl), y1 = sy(f.slabTop);
          return (
            <g key={`dm${i}`}>
              <line x1={x} y1={y0} x2={x} y2={y1} />
              <line x1={x - 4} y1={y0} x2={x + 4} y2={y0} /><line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
              <text x={x - 4} y={(y0 + y1) / 2} fontSize={8.5} fontWeight={700} fill={INK} stroke="none" textAnchor="middle" transform={`rotate(-90 ${x - 4} ${(y0 + y1) / 2})`}>{plain(f.slabTop - f.ffl)}</text>
            </g>
          );
        })}
      </g>

      {/* levels (right) */}
      {showLevels && sorted.map((m, i) => {
        const y = sy(m.z), ly = labelY[i], bx = rightEdge + 3.2 * S, bw = 13 * S;
        return (
          <g key={`lv${i}`} style={{ fontFamily: "Arial, sans-serif" }}>
            <line x1={rightEdge + 0.4 * S} y1={y} x2={bx} y2={ly} stroke={THIN} strokeWidth={0.6} strokeDasharray="2 3" />
            <polygon points={`${bx},${ly} ${bx - 6},${ly - 3} ${bx - 6},${ly + 3}`} fill={INK} />
            <rect x={bx} y={ly - 8.5} width={bw} height={17} rx={3} fill="#fff" stroke={INK} strokeWidth={0.8} />
            <text x={bx + 6} y={ly + 3.5} fontSize={8.5} fontWeight={700}>{m.text}</text>
            <text x={bx + bw - 6} y={ly + 3.5} fontSize={8.5} fontWeight={700} fill="#1d3fbf" textAnchor="end">{fmtFtIn(m.z + plinth)}</text>
          </g>
        );
      })}

      {/* title */}
      <text x={leftM + (L * S) / 2} y={H - 2.2 * S} textAnchor="middle" fontSize={18} fontWeight={800} style={{ fontFamily: "Arial, sans-serif" }}>{title}</text>
      <text x={leftM + (L * S) / 2} y={H - 1.0 * S} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={THIN} style={{ fontFamily: "Arial, sans-serif" }}>
        {`(LOOKING ${lookTxt}${model.floors.some((f) => f.stairs.length) ? " - THROUGH STAIR" : ""}, CUT AT ${posTxt})`}
      </text>
    </svg>
  );
}
