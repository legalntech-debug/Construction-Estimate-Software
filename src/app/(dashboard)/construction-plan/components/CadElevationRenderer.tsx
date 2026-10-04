import React from "react";
import { formatDim, renderTopWidthDim, renderHeightDim } from "./CadDimUtils";
import { DrawingDefs, GroundLine, LevelMarkers, levelTagsFrom, INK, GREY, GLASS } from "./CadDrawKit";
import { ElevationModel, ElevOpening, Levels } from "../engine/sectionEngine";

interface Props {
  model: ElevationModel;
  levels: Levels;
  scale: number;
  x0: number;
  measurementUnit?: "FEET" | "METERS";
  hasBasement?: boolean;
  basementFt?: number;
}

/** Facade elevation: every door / window / gate / balcony comes from the plan walls on that side. */
export default function CadElevationRenderer({ model, levels, scale, x0, measurementUnit }: Props) {
  const X = (a: number) => x0 + a * scale;
  const Y = (z: number) => -z * scale;
  const rect = (a0: number, a1: number, z0: number, z1: number) => ({
    x: X(Math.min(a0, a1)), y: Y(Math.max(z0, z1)), width: Math.abs(a1 - a0) * scale, height: Math.abs(z1 - z0) * scale,
  });
  const fmt = (ft: number) => formatDim(ft * scale, scale, measurementUnit);
  const plinth = levels.plinthFt;
  const len = model.lengthA;
  const topZ = model.tower && levels.towerTop !== undefined ? levels.towerTop : levels.parapetTop;
  const sw = (v: number) => ({ strokeWidth: v, vectorEffect: "non-scaling-stroke" as const });

  const renderOpening = (o: ElevOpening, key: string) => {
    const r = rect(o.a0, o.a1, o.z0, o.z1);
    if (o.kind === "W") {
      const m = 0.18;
      return (
        <g key={key}>
          <rect {...rect(o.a0 - 0.1, o.a1 + 0.1, o.z1, o.z1 + 0.25)} fill="#fff" stroke={INK} {...sw(0.6)} />
          <rect {...r} fill="#fff" stroke={INK} {...sw(1)} />
          <rect {...rect(o.a0 + m, o.a1 - m, o.z0 + m, o.z1 - m)} fill={GLASS} stroke={INK} {...sw(0.5)} />
          <line x1={X((o.a0 + o.a1) / 2)} y1={r.y} x2={X((o.a0 + o.a1) / 2)} y2={r.y + r.height} stroke={INK} {...sw(0.6)} />
          <rect {...rect(o.a0 - 0.2, o.a1 + 0.2, o.z0 - 0.22, o.z0)} fill="#fff" stroke={INK} {...sw(0.8)} />
        </g>
      );
    }
    if (o.kind === "V") {
      return (
        <g key={key}>
          <rect {...r} fill={GLASS} stroke={INK} {...sw(0.9)} />
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1={r.x} y1={r.y + r.height * t} x2={r.x + r.width} y2={r.y + r.height * t} stroke={INK} {...sw(0.4)} />
          ))}
        </g>
      );
    }
    if (o.kind === "G") {
      const bars = Math.max(2, Math.round((o.a1 - o.a0) / 0.5));
      return (
        <g key={key}>
          <rect {...rect(o.a0 - 0.1, o.a1 + 0.1, o.z1, o.z1 + 0.3)} fill="#fff" stroke={INK} {...sw(0.6)} />
          <rect {...r} fill="#f1f5f9" stroke={INK} {...sw(1.1)} />
          {Array.from({ length: bars - 1 }).map((_, i) => (
            <line key={i} x1={r.x + ((i + 1) * r.width) / bars} y1={r.y} x2={r.x + ((i + 1) * r.width) / bars} y2={r.y + r.height} stroke={GREY} {...sw(0.4)} />
          ))}
          <line x1={X((o.a0 + o.a1) / 2)} y1={r.y} x2={X((o.a0 + o.a1) / 2)} y2={r.y + r.height} stroke={INK} {...sw(0.9)} />
        </g>
      );
    }
    if (o.kind === "B") {
      const n = Math.max(3, Math.round((o.a1 - o.a0) / 0.4));
      return (
        <g key={key}>
          <rect {...rect(o.a0 - 0.1, o.a1 + 0.1, o.z0 - 0.5, o.z0)} fill={INK} stroke={INK} {...sw(0.6)} />
          <line x1={X(o.a0)} y1={Y(o.z1)} x2={X(o.a1)} y2={Y(o.z1)} stroke={INK} {...sw(1.2)} />
          <line x1={X(o.a0)} y1={Y(o.z0 + 0.3)} x2={X(o.a1)} y2={Y(o.z0 + 0.3)} stroke={INK} {...sw(0.7)} />
          {Array.from({ length: n + 1 }).map((_, i) => (
            <line key={i} x1={X(o.a0 + ((o.a1 - o.a0) * i) / n)} y1={Y(o.z0 + 0.3)} x2={X(o.a0 + ((o.a1 - o.a0) * i) / n)} y2={Y(o.z1)} stroke={GREY} {...sw(0.5)} />
          ))}
        </g>
      );
    }
    // door
    return (
      <g key={key}>
        <rect {...rect(o.a0 - 0.1, o.a1 + 0.1, o.z1, o.z1 + 0.25)} fill="#fff" stroke={INK} {...sw(0.6)} />
        <rect {...r} fill="#f8fafc" stroke={INK} {...sw(1)} />
        <rect {...rect(o.a0 + 0.25, o.a1 - 0.25, o.z0 + 0.3, o.z1 - 0.3)} fill="none" stroke={GREY} {...sw(0.5)} />
        <line x1={r.x + r.width * 0.5} y1={r.y} x2={r.x + r.width * 0.5} y2={r.y + r.height} stroke={GREY} {...sw(0.4)} />
      </g>
    );
  };

  const nSteps = Math.max(1, Math.ceil(plinth / 0.5));
  const titleY = Y(-plinth) + 12 * scale;

  return (
    <g className={`elevation-view elevation-${model.side}`}>
      <DrawingDefs />

      {/* stair tower (mumty) sits behind the parapet */}
      {model.tower && levels.towerTop !== undefined && (
        <g>
          <rect {...rect(model.tower.a0, model.tower.a1, levels.roofSlabTop, levels.towerTop - 0.5)} fill="#fff" stroke={INK} {...sw(1)} />
          <rect {...rect(model.tower.a0 - 0.2, model.tower.a1 + 0.2, levels.towerTop - 0.5, levels.towerTop)} fill="#fff" stroke={INK} {...sw(1)} />
          <text x={X((model.tower.a0 + model.tower.a1) / 2)} y={Y(levels.towerTop) - 6} fill={INK} fontSize="5.4" fontWeight="bold" textAnchor="middle">
            STAIR TOWER ({fmt(model.tower.a1 - model.tower.a0)} WIDE, SETBACK {fmt(model.tower.setbackFt)})
          </text>
        </g>
      )}

      {/* plinth + steps at ground-floor doors */}
      <rect {...rect(0, len, -plinth, 0)} fill="#f3f4f6" stroke={INK} {...sw(1)} />
      {model.floors[0]?.steps?.map((s, i) => (
        <g key={`steps-${i}`}>
          {Array.from({ length: nSteps }).map((_, k) => {
            const grow = (nSteps - 1 - k) * 0.35;
            return <rect key={k} {...rect(s.a0 - grow, s.a1 + grow, -plinth + (k * plinth) / nSteps, -plinth + ((k + 1) * plinth) / nSteps)} fill="#fff" stroke={INK} {...sw(0.7)} />;
          })}
        </g>
      ))}

      {/* floors */}
      {model.floors.map((f, fi) => (
        <g key={`ef-${fi}`}>
          <rect {...rect(f.a0, f.a1, f.ffl, f.clearTop)} fill="#fff" stroke={INK} {...sw(1.1)} />
          <rect {...rect(f.a0 - 0.15, f.a1 + 0.15, f.clearTop, f.slabTop)} fill="#fff" stroke={INK} {...sw(1.4)} />
          {f.openings.map((o, k) => renderOpening(o, `op-${fi}-${k}`))}
        </g>
      ))}

      {/* parapet with coping */}
      <rect {...rect(0, len, levels.roofSlabTop, levels.parapetTop)} fill="#fff" stroke={INK} {...sw(1.1)} />
      <rect {...rect(-0.15, len + 0.15, levels.parapetTop - 0.3, levels.parapetTop)} fill="#fff" stroke={INK} {...sw(1.2)} />
      <line x1={X(0)} y1={Y(levels.roofSlabTop + 0.9)} x2={X(len)} y2={Y(levels.roofSlabTop + 0.9)} stroke={GREY} {...sw(0.4)} />

      {/* ground */}
      <GroundLine xa={X(0)} xb={X(len)} plinthFt={plinth} scale={scale} />

      {/* dimensions + levels */}
      {renderTopWidthDim(X(0), len * scale, Y(topZ) - 4 * scale, fmt(len), scale)}
      {renderHeightDim(X(0), Y(0), Y(-plinth), fmt(plinth), "left", INK, scale)}
      {levels.floors.map((lf, i) => (
        <g key={`ehd-${i}`}>{renderHeightDim(X(0), Y(lf.ffl), Y(lf.slabTop), fmt(lf.slabTop - lf.ffl), "left", INK, scale)}</g>
      ))}
      <LevelMarkers tags={levelTagsFrom(levels, !!model.tower)} plinthFt={plinth} xEdge={X(len) + 0.6 * scale} scale={scale} unit={measurementUnit} />

      <text x={X(len / 2)} y={titleY} fill={INK} fontSize="10" fontWeight="bold" textAnchor="middle">{model.title}</text>
    </g>
  );
}
