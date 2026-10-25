"use client";

import React from "react";
import type { PieceInfo, Pt } from "../subdivisionTypes";
import { DimH, DimV, HALO, INK, Unit, areaUnitLabel, fmtDim } from "./drawingKit";

/* =========================================================
   ENGINEERING-STYLE SUBDIVISION PIECES
   ---------------------------------------------------------
   Black line work on white, no colour fills:
   - PLOT pieces : plain outline, number in a circle, name,
                   dimension lines (width on top, depth on the
                   left) and area.
   - Open land / road / passage : diagonal hatching.
   - Irregular pieces : the length of every edge is written
                   along that edge.
   (ox, oy) is the drawing position of the plot's top-left
   corner and `scale` converts plot units to drawing units.
========================================================= */

interface EngineeringPiecesProps {
  pieces: PieceInfo[];
  ox: number;
  oy: number;
  scale: number;
  unit: Unit;
  selectedPieceId?: string | null;
  onPieceClick?: (id: string) => void;
  /** Unique per drawing on a page (used for the hatch pattern id). */
  idPrefix?: string;
  /** "thumb" = outline + plot numbers only (template pictures). */
  variant?: "full" | "thumb";
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const isRoadLike = (label: string) => /^(ROAD|PASSAGE)/i.test((label || "").trim());

function pointInPolygon(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export default function EngineeringPieces({
  pieces,
  ox,
  oy,
  scale,
  unit,
  selectedPieceId = null,
  onPieceClick,
  idPrefix = "sdv",
  variant = "full",
}: EngineeringPiecesProps) {
  const hatchId = `${idPrefix}-hatch`;
  const thumb = variant === "thumb";

  return (
    <g fontFamily="Arial, Helvetica, sans-serif">
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width={thumb ? 3 : 5} height={thumb ? 3 : 5} patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={thumb ? 3 : 5} stroke={INK} strokeWidth={thumb ? 0.35 : 0.45} />
        </pattern>
      </defs>

      {pieces.map((pc) => {
        const world: Pt[] = pc.polygon.map((p) => ({ x: ox + p.x * scale, y: oy + p.y * scale }));
        const pts = world.map((p) => `${p.x},${p.y}`).join(" ");
        const minX = ox + pc.bbox.minX * scale;
        const minY = oy + pc.bbox.minY * scale;
        const wPx = pc.bbox.w * scale;
        const hPx = pc.bbox.h * scale;
        const maxX = minX + wPx;
        const maxY = minY + hPx;
        const isPlot = pc.kind === "PLOT";
        const road = isRoadLike(pc.label);
        const selected = pc.id === selectedPieceId;
        const cx = pc.isRect ? minX + wPx / 2 : ox + pc.centroid.x * scale;
        const cy = pc.isRect ? minY + hPx / 2 : oy + pc.centroid.y * scale;

        const outline = (
          <>
            <polygon points={pts} fill="#ffffff" stroke="none" />
            {!isPlot && <polygon points={pts} fill={`url(#${hatchId})`} stroke="none" />}
            <polygon
              points={pts}
              fill="none"
              stroke={INK}
              strokeWidth={selected ? 2.4 : thumb ? 0.8 : 1.1}
              strokeLinejoin="miter"
            />
          </>
        );

        /* ---------- thumbnail: only the plot number ---------- */
        if (thumb) {
          const f = clamp(Math.min(wPx, hPx) / 3, 3, 7);
          return (
            <g key={pc.id}>
              {outline}
              {isPlot && (
                <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={f} fontWeight={800} fill={INK}>
                  {pc.number}
                </text>
              )}
            </g>
          );
        }

        /* ---------- full drawing ---------- */
        const f = clamp(Math.min(wPx, hPx) / 9, 3.6, 7);
        // Hatched pieces (open land / road / passage) stay clean: no inner dimension lines
        const showDims = isPlot && pc.isRect && wPx >= 56 && hPx >= 46;
        const off = Math.max(6, f * 1.9);

        // Text block (badge / name / size / area), centred in the free area of the piece
        let badge = isPlot && hPx >= 64 && wPx >= 46;
        let area = !road && hPx >= 36 && wPx >= 40;
        const sizeLine = !showDims && !road && wPx >= 30 && hPx >= 24;
        const heights = () => (badge ? f * 2.4 : 0) + f * 1.5 + (sizeLine ? f * 1.3 : 0) + (area ? f * 1.3 : 0);
        const usableTop = minY + (showDims ? off + f * 0.8 : f * 0.4);
        const usableBottom = maxY - f * 0.4;
        if (heights() > usableBottom - usableTop) badge = false;
        if (heights() > usableBottom - usableTop) area = false;

        const H = heights();
        let y = clamp(cy - H / 2, usableTop, Math.max(usableTop, usableBottom - H));
        const tx = cx + (showDims ? f * 1.0 : 0);
        const nodes: React.ReactNode[] = [];

        if (badge) {
          nodes.push(
            <g key="badge">
              <circle cx={tx} cy={y + f * 1.2} r={f * 0.85} fill="#ffffff" stroke={INK} strokeWidth={0.8} />
              <text x={tx} y={y + f * 1.2} dy="0.35em" textAnchor="middle" fontSize={f * 0.95} fontWeight={800} fill={INK}>
                {pc.number}
              </text>
            </g>
          );
          y += f * 2.4;
        }

        const labelW = pc.label.length * f * 0.64 + 6;
        nodes.push(
          <g key="label">
            {!isPlot && <rect x={tx - labelW / 2} y={y + f * 0.15} width={labelW} height={f * 1.25} fill="#ffffff" />}
            <text x={tx} y={y + f * 1.05} textAnchor="middle" fontSize={f * 1.15} fontWeight={800} fill={INK} style={isPlot ? HALO : undefined}>
              {pc.label}
            </text>
          </g>
        );
        y += f * 1.5;

        if (sizeLine) {
          nodes.push(
            <text key="size" x={tx} y={y + f * 0.95} textAnchor="middle" fontSize={f * 0.9} fontWeight={700} fill={INK} style={HALO}>
              {`${fmtDim(pc.bbox.w, unit)} × ${fmtDim(pc.bbox.h, unit)}${pc.isRect ? "" : " (IRR)"}`}
            </text>
          );
          y += f * 1.3;
        }

        if (area) {
          nodes.push(
            <text key="area" x={tx} y={y + f * 0.95} textAnchor="middle" fontSize={f * 0.85} fontWeight={700} fill={INK} style={HALO}>
              {`${pc.area.toFixed(0)} ${areaUnitLabel(unit)}`}
            </text>
          );
        }

        // Edge lengths of irregular pieces
        const edges: React.ReactNode[] = [];
        if (!pc.isRect) {
          for (let i = 0; i < world.length; i++) {
            const a = world[i];
            const b = world[(i + 1) % world.length];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lenPx = Math.hypot(dx, dy);
            if (lenPx < 16) continue;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            let nx = dy / lenPx;
            let ny = -dx / lenPx;
            if (!pointInPolygon({ x: mx + nx * 0.8, y: my + ny * 0.8 }, world)) { nx = -nx; ny = -ny; }
            const ex = mx + nx * f * 1.15;
            const ey = my + ny * f * 1.15;
            let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (ang > 90 || ang < -90) ang += 180;
            edges.push(
              <text
                key={`e${i}`}
                transform={`translate(${ex},${ey}) rotate(${ang})`}
                textAnchor="middle"
                dy="0.35em"
                fontSize={f * 0.85}
                fontWeight={700}
                fill={INK}
                style={HALO}
              >
                {fmtDim(lenPx / scale, unit)}
              </text>
            );
          }
        }

        return (
          <g key={pc.id} onClick={() => onPieceClick?.(pc.id)} style={{ cursor: onPieceClick ? "pointer" : "default" }}>
            {outline}
            {showDims && (
              <>
                <DimH x1={minX + 1.5} x2={maxX - 1.5} y={minY + off} text={fmtDim(pc.bbox.w, unit)} size={f * 0.95} />
                <DimV x={minX + off} y1={minY + off + 2} y2={maxY - 1.5} text={fmtDim(pc.bbox.h, unit)} size={f * 0.95} textSide="right" />
              </>
            )}
            {edges}
            {nodes}
          </g>
        );
      })}
    </g>
  );
}
