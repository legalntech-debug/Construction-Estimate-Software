"use client";

import React from "react";
import type { PieceInfo } from "../subdivisionTypes";
import EngineeringPieces from "./EngineeringPieces";
import { DimH, DimV, INK, Unit, fmtDim } from "./drawingKit";

/* =========================================================
   SUBDIVISION SKETCH
   Stand-alone engineering-style drawing of the plot and its
   pieces. Used for the live preview inside the input form and
   for the small template pictures (variant = "thumb").
========================================================= */

interface SubdivisionSketchProps {
  plotW: number;
  plotD: number;
  pieces: PieceInfo[];
  unit: Unit;
  variant?: "full" | "thumb";
  idPrefix?: string;
  selectedPieceId?: string | null;
}

export default function SubdivisionSketch({
  plotW,
  plotD,
  pieces,
  unit,
  variant = "full",
  idPrefix = "sdv-sketch",
  selectedPieceId = null,
}: SubdivisionSketchProps) {
  const full = variant === "full";
  const W = Math.max(plotW, 1);
  const D = Math.max(plotD, 1);
  const marginL = full ? 54 : 5;
  const marginT = full ? 44 : 5;
  const marginR = full ? 16 : 5;
  const marginB = full ? 16 : 5;
  const s = full ? Math.min(520 / W, 340 / D) : Math.min(80 / W, 54 / D);
  const pw = W * s;
  const ph = D * s;
  const ox = marginL;
  const oy = marginT;
  const vbW = marginL + pw + marginR;
  const vbH = marginT + ph + marginB;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={full ? "w-full h-auto bg-white border border-black" : "w-full h-auto bg-white"}
      role="img"
      aria-label="Subdivision sketch"
    >
      <rect x={0} y={0} width={vbW} height={vbH} fill="#ffffff" />
      <EngineeringPieces
        pieces={pieces}
        ox={ox}
        oy={oy}
        scale={s}
        unit={unit}
        idPrefix={idPrefix}
        variant={variant}
        selectedPieceId={selectedPieceId}
      />
      {/* Plot boundary (heavy line) */}
      <rect x={ox} y={oy} width={pw} height={ph} fill="none" stroke={INK} strokeWidth={full ? 1.8 : 1.2} />
      {full && (
        <>
          <DimH x1={ox} x2={ox + pw} y={oy - 18} text={fmtDim(W, unit)} size={8} />
          <DimV x={ox - 22} y1={oy} y2={oy + ph} text={fmtDim(D, unit)} size={8} textSide="left" />
          {pieces.length === 0 && (
            <text x={ox + pw / 2} y={oy + ph / 2} textAnchor="middle" fontSize={9} fontWeight={700} fill={INK}>
              NO PIECES YET
            </text>
          )}
        </>
      )}
    </svg>
  );
}
