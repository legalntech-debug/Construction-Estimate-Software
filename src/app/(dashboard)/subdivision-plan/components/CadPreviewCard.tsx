"use client";

import React, { useState } from "react";
import type { PieceInfo } from "../subdivisionTypes";
import SubdivisionSketch from "./SubdivisionSketch";
import CadViewModal from "./CadViewModal";
import type { Unit } from "./drawingKit";

/* =========================================================
   CAD PREVIEW CARD
   Compact replacement for the big inline layout drawing, so the
   input form stays light. Shows a small live thumbnail and the
   key numbers; the "OPEN CAD VIEW" button opens the full
   zoom / pan engineering drawing.
========================================================= */

interface CadPreviewCardProps {
  plotW: number;
  plotD: number;
  pieces: PieceInfo[];
  unit: Unit;
  selectedPieceId?: string | null;
  idPrefix: string;
  plotArea: number;
  allocatedArea: number;
  balanceArea: number;
}

export default function CadPreviewCard({
  plotW,
  plotD,
  pieces,
  unit,
  selectedPieceId = null,
  idPrefix,
  plotArea,
  allocatedArea,
  balanceArea,
}: CadPreviewCardProps) {
  const [open, setOpen] = useState(false);
  const areaU = unit === "FEET" ? "SQ.FT" : "SQ.M";
  const plots = pieces.filter((p) => p.kind === "PLOT").length;

  // Same geometry as the sketch (full variant) so the aspect ratio matches the viewer
  const W = Math.max(plotW, 1);
  const D = Math.max(plotD, 1);
  const s = Math.min(520 / W, 340 / D);
  const aspect = (54 + W * s + 16) / (44 + D * s + 16);

  return (
    <>
      <div className="border-2 border-black bg-white">
        <div className="bg-black text-white px-3 py-1.5 text-xs font-black flex justify-between items-center">
          <span>CAD VIEW</span>
          <span className="opacity-80">{plots} PLOT{plots === 1 ? "" : "S"} · {pieces.length} PIECES</span>
        </div>

        <div className="p-3 flex flex-col sm:flex-row lg:flex-col gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block border border-black bg-white cursor-pointer sm:w-48 lg:w-full max-w-full self-center"
            aria-label="Open CAD view"
            title="Open CAD view"
          >
            <SubdivisionSketch plotW={plotW} plotD={plotD} pieces={pieces} unit={unit} variant="thumb" idPrefix={`${idPrefix}-thumb`} selectedPieceId={selectedPieceId} />
          </button>

          <div className="flex-1 min-w-0 text-xs font-bold space-y-1">
            <div className="flex justify-between gap-2"><span>PLOT AREA</span><span>{plotArea} {areaU}</span></div>
            <div className="flex justify-between gap-2"><span>PIECES TOTAL</span><span>{allocatedArea} {areaU}</span></div>
            <div className="flex justify-between gap-2 border-t border-black pt-1">
              <span>UNALLOCATED</span><span>{balanceArea > 0 ? balanceArea : 0} {areaU}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2 w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black px-3 py-2 text-xs font-black cursor-pointer transition"
            >
              🖥 OPEN CAD VIEW
            </button>
          </div>
        </div>
      </div>

      <CadViewModal
        open={open}
        onClose={() => setOpen(false)}
        title="CAD VIEW — SUBDIVISION LAYOUT"
        aspect={aspect}
        status={`PLOT ${plotW.toFixed(2)} × ${plotD.toFixed(2)} ${unit === "FEET" ? "FT" : "M"} · ${plots} PLOTS · ${pieces.length} PIECES`}
      >
        <SubdivisionSketch plotW={plotW} plotD={plotD} pieces={pieces} unit={unit} idPrefix={`${idPrefix}-cad`} selectedPieceId={selectedPieceId} />
      </CadViewModal>
    </>
  );
}
