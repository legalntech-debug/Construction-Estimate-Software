/* =========================================================
SUB DIVISION LAYOUT — TYPES
========================================================= */

export type Pt = { x: number; y: number };

export type PieceKind = "PLOT" | "REMAINDER";

export interface SubPiece {
  id: string;
  polygon: Pt[];
  kind: PieceKind;
}

export interface PieceInfo extends SubPiece {
  number: number;
  label: string;
  area: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number };
  isRect: boolean;
  centroid: Pt;
}

export type CutScope = "ALL" | "PIECE";

export interface CutLine {
  a: Pt;
  b: Pt;
  scope: CutScope;
  pieceId?: string;
}

export type Corner = "TL" | "TR" | "BL" | "BR";
export type EdgeFrom = "LEFT" | "RIGHT" | "TOP" | "BOTTOM";

// ✅ Naye Types jo missing the (Yahan add kar diye hain)
export type PlotShape = "RECTANGLE" | "SQUARE" | "TRAPEZOIDAL" | "POLYGON" | "IRREGULAR" | "L-SHAPE";

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