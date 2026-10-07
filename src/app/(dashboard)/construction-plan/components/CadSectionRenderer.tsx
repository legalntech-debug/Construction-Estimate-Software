import React from "react";
import { formatDim, renderTopWidthDim, renderHeightDim } from "./CadDimUtils";
import { DrawingDefs, GroundLine, LevelMarkers, PlinthDim, HDim, levelTagsFrom, INK, GREY, FS } from "./CadDrawKit";
import { SectionModel, Levels, SectionFloor, WallCut, WALL_T } from "../engine/sectionEngine";

interface Props {
  model: SectionModel;
  levels: Levels;
  scale: number;
  x0: number;
  measurementUnit?: "FEET" | "METERS";
  mosV0Ft?: number;      // open ground (plot setback) beyond the building at the v = 0 end
  mosV1Ft?: number;      // ... at the v = lengthV end
  hasBasement?: boolean;
  basementFt?: number;
}

const BOUNDARY_WALL_H = 6;            // ft above G.L.
const BOUNDARY_WALL_T = 8 / 12;       // 8" thick

/** free parts of [lo,hi] after removing the given intervals */
function subtract(lo: number, hi: number, cut: [number, number][]): [number, number][] {
  const hs = cut.filter((h) => h[1] > lo && h[0] < hi).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = lo;
  for (const [a, b] of hs) { if (a > cur) out.push([cur, Math.min(a, hi)]); cur = Math.max(cur, b); }
  if (cur < hi) out.push([cur, hi]);
  return out.filter((s) => s[1] - s[0] > 0.05);
}

/**
 * Engineering section.  Pure line-work (no background fills):
 *  SOLID BLACK = cut RCC slabs / beams / stair / cut walls   THIN LINES = everything seen BEYOND the cut plane
 */
export default function CadSectionRenderer({
  model, levels, scale, x0, measurementUnit, mosV0Ft = 0, mosV1Ft = 0, hasBasement, basementFt = 8,
}: Props) {
  const len = model.lengthV;
  const vertical = model.cut.axis === "VERTICAL";
  const X = (v: number) => x0 + (model.flip ? len - v : v) * scale;
  const Y = (z: number) => -z * scale;
  const R = (v0: number, v1: number, z0: number, z1: number) => ({
    x: Math.min(X(v0), X(v1)), y: Y(Math.max(z0, z1)), width: Math.abs(X(v1) - X(v0)), height: Math.abs(z1 - z0) * scale,
  });
  const fmt = (ft: number) => formatDim(ft * scale, scale, measurementUnit);
  const plinth = levels.plinthFt;
  const topZ = levels.towerTop !== undefined && model.tower ? levels.towerTop : levels.parapetTop;
  const xl = Math.min(X(0), X(len)), xr = Math.max(X(0), X(len));
  const xa = Math.min(X(-mosV0Ft), X(len + mosV1Ft)), xb = Math.max(X(-mosV0Ft), X(len + mosV1Ft));
  const sideNames = vertical ? ["REAR", "FRONT"] : ["LEFT", "RIGHT"];         // v = 0 end, v = len end
  const first = model.floors[0];
  const sw = { vectorEffect: "non-scaling-stroke" as const };
  const halo = { paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "2.4px" } as React.CSSProperties;

  /* ---- masonry wall (cut) with door / window gaps ---- */
  const renderWall = (w: WallCut, f: SectionFloor, key: string) => {
    const pieces: [number, number][] = [];
    const gaps = [...w.gaps].sort((a, b) => a.z0 - b.z0);
    let z = f.ffl;
    gaps.forEach((g) => {
      if (g.z0 + f.ffl > z) pieces.push([z, g.z0 + f.ffl]);
      z = Math.max(z, g.z1 + f.ffl);
    });
    pieces.push([z, f.clearTop]);
    const thick = Math.abs(X(w.v1) - X(w.v0)) >= 7;
    return (
      <g key={key}>
        {pieces.filter((p) => p[1] - p[0] > 0.01).map((p, i) => (
          <rect key={i} {...R(w.v0, w.v1, p[0], p[1])} fill={thick ? "url(#secWall)" : INK} stroke={INK} strokeWidth="0.9" {...sw} />
        ))}
        {gaps.map((g, i) => (
          <rect key={`lt${i}`} {...R(w.v0, w.v1, g.z1 + f.ffl, g.z1 + f.ffl + 0.5)} fill="url(#secRcc)" stroke={INK} strokeWidth="0.8" {...sw} />
        ))}
        {gaps.filter((g) => g.kind === "D").map((g, i) => (
          <line key={`dj${i}`} x1={X(w.v0)} y1={Y(g.z1 + f.ffl)} x2={X(w.v1)} y2={Y(g.z1 + f.ffl)} stroke={INK} strokeWidth="1.2" {...sw} />
        ))}
        {gaps.filter((g) => g.kind === "W").map((g, i) => {
          const cx = (X(w.v0) + X(w.v1)) / 2;
          return (
            <g key={`w${i}`}>
              <line x1={cx} y1={Y(g.z0 + f.ffl)} x2={cx} y2={Y(g.z1 + f.ffl)} stroke={INK} strokeWidth="1.4" {...sw} />
              <rect {...R(w.v0 - 0.12, w.v1 + 0.12, g.z0 + f.ffl - 0.25, g.z0 + f.ffl)} fill="none" stroke={INK} strokeWidth="0.7" {...sw} />
            </g>
          );
        })}
      </g>
    );
  };

  /* ---- beyond face (thin) with doors / windows ---- */
  const renderFace = (f: SectionFloor, fc: SectionFloor["faces"][number], i: number) => (
    <g key={`face-${f.name}-${i}`}>
      <rect {...R(fc.v0, fc.v1, f.ffl, f.clearTop)} fill="none" stroke={GREY} strokeWidth="0.45" {...sw} />
      {fc.openings.map((o, k) => {
        const a0 = Math.max(o.a0, fc.v0), a1 = Math.min(o.a1, fc.v1);
        const r = R(a0, a1, f.ffl + o.z0, f.ffl + o.z1);
        return (
          <g key={k}>
            <rect {...r} fill="none" stroke={INK} strokeWidth="0.7" {...sw} />
            {o.kind === "D" ? (
              <rect x={r.x + r.width * 0.15} y={r.y + r.height * 0.08} width={r.width * 0.7} height={r.height * 0.84} fill="none" stroke={GREY} strokeWidth="0.4" {...sw} />
            ) : (
              <>
                <line x1={r.x + r.width / 2} y1={r.y} x2={r.x + r.width / 2} y2={r.y + r.height} stroke={INK} strokeWidth="0.4" {...sw} />
                <line x1={r.x} y1={r.y + r.height / 2} x2={r.x + r.width} y2={r.y + r.height / 2} stroke={INK} strokeWidth="0.4" {...sw} />
              </>
            )}
          </g>
        );
      })}
    </g>
  );

  const slabSegments = (f: SectionFloor): [number, number][] => subtract(0, f.outerLen, f.holes);

  /* ---- room names: never overlap each other / sub-rooms / the stair ---- */
  const roomLabels = (f: SectionFloor) => {
    const stairSpans: [number, number][] = f.stairs.flatMap((st) => {
      const vs = st.polys.flatMap((p) => p.pts.map((q) => q[0]));
      return vs.length ? [[Math.min(...vs) - 0.25, Math.max(...vs) + 0.25] as [number, number]] : [];
    });
    const out: React.ReactNode[] = [];
    f.rooms.forEach((r, i) => {
      const a = r.v0 + WALL_T / 2, b = r.v1 - WALL_T / 2;
      // sub-rooms (completely inside this one) and exact duplicates of an earlier room are removed from the free space
      const cutOut: [number, number][] = [...stairSpans];
      f.rooms.forEach((q, j) => {
        if (j === i) return;
        const inside = q.v0 >= r.v0 - 0.05 && q.v1 <= r.v1 + 0.05 && (q.v1 - q.v0) < (r.v1 - r.v0) - 0.3;
        const same = Math.abs(q.v0 - r.v0) < 0.3 && Math.abs(q.v1 - r.v1) < 0.3 && j < i;
        if (inside) cutOut.push([q.v0 - 0.15, q.v1 + 0.15]);
        if (same) cutOut.push([r.v0 - 1, r.v1 + 1]);
      });
      const free = subtract(a, b, cutOut).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
      if (!free) return;
      const availPx = (free[1] - free[0]) * scale - 4;
      const name = r.name.replace(/\s*\(.*\)$/, "");
      const tw = (t: string) => t.length * FS * 0.62;
      let lines = [name];
      if (tw(name) > availPx) {
        const words = name.split(" ");
        if (words.length < 2) return;
        let best = 1, diff = 1e9;
        for (let k = 1; k < words.length; k++) {
          const d = Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
          if (d < diff) { diff = d; best = k; }
        }
        lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
        if (Math.max(...lines.map(tw)) > availPx) return;
      }
      const cx = X((free[0] + free[1]) / 2);
      lines.forEach((t, k) => out.push(
        <text key={`rn-${f.name}-${i}-${k}`} x={cx} y={Y(f.clearTop - 1.2) + k * FS * 1.15} fill={INK} fontSize={FS} fontWeight="bold" textAnchor="middle" style={halo}>{t}</text>
      ));
    });
    return out;
  };

  const towerTopZ = levels.towerTop ?? levels.roofSlabTop;
  // parapet wall STOPS at the stair-tower walls (it never runs through the tower)
  const parapetSegs: [number, number][] = (() => {
    if (!model.tower) return [[0, len]];
    const t0 = Math.max(0, model.tower.v0), t1 = Math.min(len, model.tower.v1);
    const segs: [number, number][] = [];
    if (t0 > 0.01) segs.push([0, t0]);
    if (t1 < len - 0.01) segs.push([t1, len]);
    return segs;
  })();
  const titleY = Y(-plinth) + (hasBasement ? basementFt * scale : 0) + 12 * scale;
  const rightEdge = xb + 16;                    // level call-outs start beyond the boundary wall + its label

  const boundary = [
    { at: -mosV0Ft, mos: mosV0Ft, name: sideNames[0], inner: 0, dir: 1 },
    { at: len + mosV1Ft, mos: mosV1Ft, name: sideNames[1], inner: len, dir: -1 },
  ].filter((b) => b.mos > 0.01);

  return (
    <g className={`section-view section-${model.cut.id}`}>
      <DrawingDefs />

      {/* ---------- ground + boundary walls + setbacks ---------- */}
      <GroundLine xa={xa} xb={xb} plinthFt={plinth} scale={scale} />
      {boundary.map((b, i) => {
        const wallIn = b.at + b.dir * BOUNDARY_WALL_T;
        const outerSign = X(b.at) >= X(b.inner) ? 1 : -1;               // screen side that faces away from the building
        const lx = X(b.at) + outerSign * 7;
        return (
          <g key={`bw-${i}`}>
            <rect {...R(b.at, wallIn, -plinth, -plinth + BOUNDARY_WALL_H)} fill={INK} stroke={INK} strokeWidth="0.7" {...sw} />
            {/* vertical label on the OUTER side of the wall, so it can never touch the building */}
            <text transform={`translate(${lx}, ${Y(-plinth) - 5}) rotate(-90)`} fill={INK} fontSize={FS} fontWeight="bold" textAnchor="start" style={halo}>
              {`${b.name} BOUNDARY WALL (${fmt(BOUNDARY_WALL_H)} HT.)`}
            </text>
            <HDim xa={X(b.at)} xb={X(b.inner)} y={Y(-plinth) + 4.8 * scale} label={`MOS ${fmt(b.mos)}`} />
          </g>
        );
      })}

      {/* ---------- foundation + plinth under every cut wall of the ground floor ---------- */}
      {first && (
        <g>
          <rect {...R(WALL_T, first.outerLen - WALL_T, -plinth, 0)} fill="url(#secDots)" stroke="none" />
          {first.walls.map((w, i) => {
            const c = (w.v0 + w.v1) / 2, fw = w.kind === "E" ? 2.5 : 2.0;
            return (
              <g key={`fd-${i}`}>
                <rect {...R(w.v0, w.v1, -plinth, 0)} fill={INK} stroke={INK} strokeWidth="0.9" {...sw} />
                <rect {...R(w.v0 - 0.15, w.v1 + 0.15, -plinth - 2.5, -plinth)} fill={INK} stroke={INK} strokeWidth="0.8" {...sw} />
                <rect {...R(c - fw / 2, c + fw / 2, -plinth - 3.5, -plinth - 2.5)} fill="url(#secDots)" stroke={INK} strokeWidth="0.9" {...sw} />
                <rect {...R(c - fw / 2 - 0.25, c + fw / 2 + 0.25, -plinth - 3.85, -plinth - 3.5)} fill="none" stroke={INK} strokeWidth="0.7" {...sw} />
              </g>
            );
          })}
          <rect {...R(WALL_T, first.outerLen - WALL_T, -0.33, 0)} fill={INK} stroke={INK} strokeWidth="0.6" {...sw} />
        </g>
      )}
      {hasBasement && (
        <g>
          <rect {...R(0, len, -plinth - basementFt, -plinth)} fill="none" stroke={INK} strokeWidth="0.8" strokeDasharray="4 2" {...sw} />
          <text x={(xl + xr) / 2} y={Y(-plinth - basementFt / 2)} fill={INK} fontSize={FS + 1} fontWeight="bold" textAnchor="middle">BASEMENT ({fmt(basementFt)})</text>
        </g>
      )}

      {/* ---------- floors ---------- */}
      {model.floors.map((f, fi) => (
        <g key={`floor-${fi}`}>
          {f.faces.map((fc, i) => renderFace(f, fc, i))}

          {f.stairs.map((s, si) => (
            <g key={`st-${si}`}>
              {s.polys.map((p, pi) => (
                <polygon
                  key={pi}
                  points={p.pts.map(([v, z]) => `${X(v)},${Y(z)}`).join(" ")}
                  fill={p.kind === "POCHE" ? INK : "none"}
                  stroke={p.kind === "POCHE" ? INK : "#444"}
                  strokeWidth={p.kind === "POCHE" ? 0.9 : 0.7}
                  strokeLinejoin="round"
                  {...sw}
                />
              ))}
              {s.relation === "CUT" && s.label && s.labelAt && (
                <text x={X(s.labelAt[0])} y={Y(s.labelAt[1]) + 11} fill={INK} fontSize={FS - 0.4} fontWeight="bold" textAnchor="middle" style={halo}>
                  {s.label}
                </text>
              )}
            </g>
          ))}

          {f.walls.map((w, i) => renderWall(w, f, `wall-${fi}-${i}`))}

          {/* RCC beam under the slab at every cut wall, then the slab itself (minus stair opening) */}
          {f.walls.map((w, i) => (
            <rect key={`bm-${fi}-${i}`} {...R(w.v0 - 0.08, w.v1 + 0.08, f.clearTop - 0.5, f.clearTop)} fill={INK} stroke={INK} strokeWidth="0.8" {...sw} />
          ))}
          {slabSegments(f).map(([a, b], i) => (
            <rect key={`sl-${fi}-${i}`} {...R(a, b, f.clearTop, f.slabTop)} fill={INK} stroke={INK} strokeWidth="0.8" {...sw} />
          ))}

          {roomLabels(f)}
        </g>
      ))}

      {/* ---------- roof: parapet (beyond band + cut ends) and tower ---------- */}
      {parapetSegs.map(([a0, b0], i) => (
        <g key={`pb-${i}`}>
          <rect {...R(a0, b0, levels.roofSlabTop, levels.parapetTop)} fill="#ffffff" stroke={GREY} strokeWidth="0.5" {...sw} />
          <rect {...R(a0 - 0.1, b0 + 0.1, levels.parapetTop - 0.25, levels.parapetTop)} fill="#ffffff" stroke={INK} strokeWidth="0.7" {...sw} />
        </g>
      ))}
      {[[0, 0.5], [len - 0.5, len]].map(([a0, b0], i) => (
        <rect key={`pp-${i}`} {...R(a0, b0, levels.roofSlabTop, levels.parapetTop)} fill={INK} stroke={INK} strokeWidth="0.9" {...sw} />
      ))}

      {model.tower && (
        <g>
          {model.tower.relation === "CUT" ? (
            <g>
              <rect {...R(model.tower.v0, model.tower.v0 + WALL_T, levels.roofSlabTop, towerTopZ - 0.5)} fill={INK} stroke={INK} strokeWidth="0.9" {...sw} />
              <rect {...R(model.tower.v1 - WALL_T, model.tower.v1, levels.roofSlabTop, towerTopZ - 0.5)} fill={INK} stroke={INK} strokeWidth="0.9" {...sw} />
              <rect {...R(model.tower.v0 - 0.2, model.tower.v1 + 0.2, towerTopZ - 0.5, towerTopZ)} fill={INK} stroke={INK} {...sw} />
            </g>
          ) : (
            <rect {...R(model.tower.v0, model.tower.v1, levels.roofSlabTop, towerTopZ)} fill="#ffffff" stroke={GREY} strokeWidth="0.7" strokeDasharray="4 3" {...sw} />
          )}
          <text x={(X(model.tower.v0) + X(model.tower.v1)) / 2} y={Y(towerTopZ) - 6} fill={INK} fontSize={FS} fontWeight="bold" textAnchor="middle">
            STAIR TOWER ({fmt(model.tower.v1 - model.tower.v0)} WIDE)
          </text>
        </g>
      )}

      {/* ---------- dimensions + levels ---------- */}
      {renderTopWidthDim(xl, xr - xl, Y(topZ) - 4 * scale, fmt(len), scale)}
      <PlinthDim x={xl} y0={Y(0)} y1={Y(-plinth)} label={fmt(plinth)} scale={scale} />
      {levels.floors.map((lf, i) => (
        <g key={`hd-${i}`}>{renderHeightDim(xl, Y(lf.ffl), Y(lf.slabTop), fmt(lf.slabTop - lf.ffl), "left", INK, scale)}</g>
      ))}

      <LevelMarkers tags={levelTagsFrom(levels, !!model.tower)} plinthFt={plinth} xEdge={rightEdge} scale={scale} unit={measurementUnit} />

      <text x={(xl + xr) / 2} y={titleY} fill={INK} fontSize="10" fontWeight="bold" textAnchor="middle">{model.title}</text>
      <text x={(xl + xr) / 2} y={titleY + 11} fill={GREY} fontSize="6" fontWeight="bold" textAnchor="middle">
        {`(LOOKING ${model.cut.look === "UP" ? "BACK" : model.cut.look === "DOWN" ? "FRONT" : model.cut.look}${model.floors.some((f) => f.stairs.some((s) => s.relation === "CUT")) ? " - THROUGH STAIR" : ""}, CUT AT ${fmt(model.positionOuterFt)} FROM ${vertical ? "LEFT" : "TOP"})`}
      </text>
    </g>
  );
}
