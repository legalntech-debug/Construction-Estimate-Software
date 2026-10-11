/* =========================================================
SUB DIVISION LAYOUT — TYPES
---------------------------------------------------------
Sab coordinates FEET me hote hain. Origin = plot ka top-left,
x right ki taraf, y neeche ki taraf (SVG jaisa).
========================================================= */

export type Pt = { x: number; y: number };

export type PieceKind = "PLOT" | "REMAINDER";

export interface SubPiece {
  /** Internal stable id (split hone par parent-id + a/b) */
  id: string;
  polygon: Pt[];
  kind: PieceKind;
}

export interface PieceInfo extends SubPiece {
  /** 1,2,3... top-left se bottom-right order me */
  number: number;
  label: string; // "PLOT 1" / "OPEN 1"
  area: number;  // sq ft
  bbox: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number };
  isRect: boolean;
  centroid: Pt;
}

export type CutScope = "ALL" | "PIECE";

export interface CutLine {
  a: Pt;
  b: Pt;
  scope: CutScope;
  pieceId?: string; // scope === "PIECE" ho to
}

export type Corner = "TL" | "TR" | "BL" | "BR";
export type EdgeFrom = "LEFT" | "RIGHT" | "TOP" | "BOTTOM";

/** Piece ka size (feet) — agar baad me kisi planner ko bhejna ho. */
export type PlotDimensions = {
  length: number;
  width: number;
  area: number;
  A?: number;
  B?: number;
  C?: number;
  D?: number;
  E?: number;
  F?: number;
  [key: string]: any;
};
