import React from "react";
import { formatDim, renderTopWidthDim, renderHeightDim } from "./CadDimUtils";
import { DrawingDefs, GroundLine, LevelMarkers, levelTagsFrom, INK, GREY, GLASS } from "./CadDrawKit";
import { SectionModel, Levels, SectionFloor, WallCut, WALL_T } from "../engine/sectionEngine";

interface Props {
  model: SectionModel;
  levels: Levels;
  scale: number;
  x0: number;
  measurementUnit?: "FEET" | "METERS";
  mosV0Ft?: number;      // open ground beyond the building at v = 0 end (plot setback) – draws boundary wall
  mosV1Ft?: number;      // ... at v = lengthV end
  hasBasement?: boolean;
  basementFt?: number;
}

/**
 * Engineering section:
 *  - SOLID BLACK  = RCC slabs / plinth beam / stair slabs (cut)
 *  - HATCHED      = masonry walls (cut)
 *  - THIN LINES   = everything that is seen BEYOND the cut plane (walls, doors, windows, stair flights)
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
  const xa = Math.min(X(-mosV0Ft), X(len + mosV1Ft)), xb = Math.max(X(-mosV0Ft), X(len + mosV1Ft));
  const xl = Math.min(X(0), X(len)), xr = Math.max(X(0), X(len));
  const sideNames = vertical ? ["REAR", "FRONT"] : ["LEFT", "RIGHT"];   // names for v=0 end and v=len end
  const first = model.floors[0];
  const wallFill = (v0: number, v1: number) => (Math.abs(v1 - v0) * scale < 6 ? "#1c1c1c" : "url(#wallHatch)");

  /* ---- masonry wall with door / window gaps ---- */
  const renderWall = (w: WallCut, f: SectionFloor, key: string) => {
    const pieces: [number, number][] = [];
    const gaps = [...w.gaps].sort((a, b) => a.z0 - b.z0);
    let z = f.ffl;
    gaps.forEach((g) => {
      if (g.z0 + f.ffl > z) pieces.push([z, g.z0 + f.ffl]);
      z = Math.max(z, g.z1 + f.ffl);
    });
    pieces.push([z, f.clearTop]);
    return (
      <g key={key}>
        {pieces.filter((p) => p[1] - p[0] > 0.01).map((p, i) => (
          <rect key={i} {...R(w.v0, w.v1, p[0], p[1])} fill={wallFill(w.v0, w.v1)} stroke={INK} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
        ))}
        {gaps.filter((g) => g.kind === "W").map((g, i) => {
          const cx = (X(w.v0) + X(w.v1)) / 2;
          return (
            <g key={`w${i}`}>
              <line x1={cx} y1={Y(g.z0 + f.ffl)} x2={cx} y2={Y(g.z1 + f.ffl)} stroke={INK} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              <rect {...R(w.v0 - 0.12, w.v1 + 0.12, g.z0 + f.ffl - 0.25, g.z0 + f.ffl)} fill="#fff" stroke={INK} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </g>
    );
  };

  const renderFace = (f: SectionFloor, fc: SectionFloor["faces"][number], i: number) => {
    const rr = R(fc.v0, fc.v1, f.ffl, f.clearTop);
    return (
      <g key={`face-${f.name}-${i}`}>
        <rect {...rr} fill="none" stroke={GREY} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        {fc.openings.map((o, k) => {
          const a0 = Math.max(o.a0, fc.v0), a1 = Math.min(o.a1, fc.v1);
          const r = R(a0, a1, f.ffl + o.z0, f.ffl + o.z1);
          return (
            <g key={k}>
              <rect {...r} fill={o.kind === "D" ? "#f8fafc" : GLASS} stroke={INK} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
              {o.kind === "D" ? (
                <rect x={r.x + r.width * 0.15} y={r.y + r.height * 0.1} width={r.width * 0.7} height={r.height * 0.8} fill="none" stroke={GREY} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
              ) : (
                <>
                  <line x1={r.x + r.width / 2} y1={r.y} x2={r.x + r.width / 2} y2={r.y + r.height} stroke={INK} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
                  <line x1={r.x} y1={r.y + r.height / 2} x2={r.x + r.width} y2={r.y + r.height / 2} stroke={INK} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
                </>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  const slabSegments = (f: SectionFloor): [number, number][] => {
    let segs: [number, number][] = [[0, f.outerLen]];
    f.holes.forEach(([h0, h1]) => {
      const next: [number, number][] = [];
      segs.forEach(([a, b]) => {
        if (h1 <= a || h0 >= b) next.push([a, b]);
        else { if (h0 > a) next.push([a, h0]); if (h1 < b) next.push([h1, b]); }
      });
      segs = next;
    });
    return segs;
  };

  const towerTopZ = (levels.towerTop ?? levels.roofSlabTop);
  const titleY = Y(-plinth) + (hasBasement ? basementFt * scale : 0) + 12 * scale;

  return (
    <g className={`section-view section-${model.cut.id}`}>
      <DrawingDefs />

      {/* ---------- ground, boundary walls ---------- */}
      <GroundLine xa={xa} xb={xb} plinthFt={plinth} scale={scale} />
      {[{ at: -mosV0Ft, on: mosV0Ft > 0, name: sideNames[0], dir: 1 }, { at: len + mosV1Ft, on: mosV1Ft > 0, name: sideNames[1], dir: -1 }].map((b, i) => b.on && (
        <g key={`bw-${i}`}>
          <rect {...R(b.at, b.at + (b.dir * 8) / 12, -plinth, -plinth + 6)} fill="#1c1c1c" stroke={INK} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <text x={X(b.at)} y={Y(-plinth + 6) - 3} fill={INK} fontSize="5" fontWeight="bold" textAnchor="middle">{b.name} BOUNDARY WALL</text>
        </g>
      ))}

      {/* ---------- foundation + plinth under every cut wall of the ground floor ---------- */}
      {first && (
        <g>
          <rect {...R(WALL_T, first.outerLen - WALL_T, -plinth, 0)} fill="url(#secDots)" stroke="none" />
          {first.walls.map((w, i) => {
            const c = (w.v0 + w.v1) / 2, fw = w.kind === "E" ? 2.5 : 2.0;
            return (
              <g key={`fd-${i}`}>
                <rect {...R(w.v0, w.v1, -plinth, 0)} fill={wallFill(w.v0, w.v1)} stroke={INK} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
                <rect {...R(w.v0 - 0.12, w.v1 + 0.12, -0.83, 0)} fill={INK} stroke={INK} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                <rect {...R(w.v0 - 0.15, w.v1 + 0.15, -plinth - 2.5, -plinth)} fill="#1c1c1c" stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                <rect {...R(c - fw / 2, c + fw / 2, -plinth - 3.5, -plinth - 2.5)} fill="url(#secDots)" stroke={INK} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
                <rect {...R(c - fw / 2 - 0.25, c + fw / 2 + 0.25, -plinth - 3.85, -plinth - 3.5)} fill="#fff" stroke={INK} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          <rect {...R(WALL_T, first.outerLen - WALL_T, -0.33, 0)} fill={INK} stroke={INK} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </g>
      )}
      {hasBasement && (
        <g>
          <rect {...R(0, len, -plinth - basementFt, -plinth)} fill="none" stroke={INK} strokeWidth="0.8" strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
          <text x={(xl + xr) / 2} y={Y(-plinth - basementFt / 2)} fill={INK} fontSize="6" fontWeight="bold" textAnchor="middle">BASEMENT ({fmt(basementFt)})</text>
        </g>
      )}

      {/* ---------- floors ---------- */}
      {model.floors.map((f, fi) => (
        <g key={`floor-${fi}`}>
          {f.faces.map((fc, i) => renderFace(f, fc, i))}
          {f.faces.map((fc, i) => (fc.v1 - fc.v0) * scale > 26 && (
            <text key={`rn-${i}`} x={(X(fc.v0) + X(fc.v1)) / 2} y={Y(f.clearTop - 1.4)} fill={INK} fontSize="5.4" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
              {fc.roomName.length > 20 ? fc.roomName.slice(0, 19) + "." : fc.roomName}
            </text>
          ))}

          {f.stairs.map((s, si) => (
            <g key={`st-${si}`}>
              {s.polys.map((p, pi) => (
                <polygon
                  key={pi}
                  points={p.pts.map(([v, z]) => `${X(v)},${Y(z)}`).join(" ")}
                  fill={p.kind === "POCHE" ? "url(#secRcc)" : "none"}
                  stroke={p.kind === "POCHE" ? INK : "#333"}
                  strokeWidth={p.kind === "POCHE" ? 0.9 : 0.8}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {s.relation === "CUT" && s.mode === "RUN" && (
                <text x={(() => { const xs = s.polys[0].pts.map((q) => X(q[0])); return (Math.min(...xs) + Math.max(...xs)) / 2; })()} y={Y(f.ffl + f.heightFt * 0.18)} fill={INK} fontSize="5" fontWeight="bold" textAnchor="middle" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "2px" }}>
                  {s.label}
                </text>
              )}
            </g>
          ))}

          {f.walls.map((w, i) => renderWall(w, f, `wall-${fi}-${i}`))}

          {/* RCC beam hanging under the slab at every cut wall, then the slab itself */}
          {f.walls.map((w, i) => (
            <rect key={`bm-${fi}-${i}`} {...R(w.v0 - 0.08, w.v1 + 0.08, f.clearTop - 0.5, f.clearTop)} fill="url(#secRcc)" stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          ))}
          {slabSegments(f).map(([a, b], i) => (
            <rect key={`sl-${fi}-${i}`} {...R(a, b, f.clearTop, f.slabTop)} fill={INK} stroke={INK} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ))}

      {/* ---------- roof: parapet (beyond band + cut ends) and tower ---------- */}
      <rect {...R(0, len, levels.roofSlabTop, levels.parapetTop)} fill="#fff" stroke={GREY} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <rect {...R(-0.1, len + 0.1, levels.parapetTop - 0.25, levels.parapetTop)} fill="none" stroke={INK} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      {[[0, 0.5], [len - 0.5, len]].map(([a, b], i) => (
        <rect key={`pp-${i}`} {...R(a, b, levels.roofSlabTop, levels.parapetTop)} fill="#1c1c1c" stroke={INK} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
      ))}

      {model.tower && (
        <g>
          <rect {...R(model.tower.v0, model.tower.v1, levels.roofSlabTop, towerTopZ)} fill="#fff" stroke={model.tower.relation === "CUT" ? INK : GREY} strokeWidth={model.tower.relation === "CUT" ? 0.9 : 0.6} vectorEffect="non-scaling-stroke" />
          {model.tower.relation === "CUT" && (
            <g>
              <rect {...R(model.tower.v0, model.tower.v0 + WALL_T, levels.roofSlabTop, towerTopZ - 0.5)} fill="#1c1c1c" stroke={INK} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
              <rect {...R(model.tower.v1 - WALL_T, model.tower.v1, levels.roofSlabTop, towerTopZ - 0.5)} fill="#1c1c1c" stroke={INK} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
              <rect {...R(model.tower.v0 - 0.2, model.tower.v1 + 0.2, towerTopZ - 0.5, towerTopZ)} fill={INK} stroke={INK} vectorEffect="non-scaling-stroke" />
            </g>
          )}
          <text x={(X(model.tower.v0) + X(model.tower.v1)) / 2} y={Y(towerTopZ) - 12} fill={INK} fontSize="5.6" fontWeight="bold" textAnchor="middle">
            STAIR TOWER ({fmt(model.tower.v1 - model.tower.v0)} WIDE)
          </text>
        </g>
      )}

      {/* ---------- dimensions + levels ---------- */}
      {renderTopWidthDim(xl, xr - xl, Y(topZ) - 4 * scale, fmt(len), scale)}
      {renderHeightDim(xl, Y(0), Y(-plinth), fmt(plinth), "left", INK, scale)}
      {levels.floors.map((lf, i) => (
        <g key={`hd-${i}`}>{renderHeightDim(xl - 0, Y(lf.ffl), Y(lf.slabTop), fmt(lf.slabTop - lf.ffl), "left", INK, scale)}</g>
      ))}

      <LevelMarkers tags={levelTagsFrom(levels, !!model.tower)} plinthFt={plinth} xEdge={xb} scale={scale} unit={measurementUnit} />

      <text x={(xl + xr) / 2} y={titleY} fill={INK} fontSize="10" fontWeight="bold" textAnchor="middle">{model.title}</text>
      <text x={(xl + xr) / 2} y={titleY + 11} fill={GREY} fontSize="6" fontWeight="bold" textAnchor="middle">
        {`(LOOKING ${model.cut.look === "UP" ? "BACK" : model.cut.look === "DOWN" ? "FRONT" : model.cut.look}${model.cut.positionFt === "AUTO" ? " - THROUGH STAIR" : ""}, CUT AT ${fmt(model.positionOuterFt)} FROM ${vertical ? "LEFT" : "TOP"})`}
      </text>
    </g>
  );
}
