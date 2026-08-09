import { PlotDimensions, PlotShape, PlotSide } from "./types";

export function calculatePlotArea(dim: PlotDimensions | undefined, shape: PlotShape): number {
  // 1. Defensive Check: Agar dim (dimensions) hi undefined ya null ho
  if (!dim) {
    console.warn("Plot dimensions are undefined in calculatePlotArea");
    return 0;
  }

  // 2. Safe extraction of values
  const A = Number(dim.A || 0);
  const B = Number(dim.B || 0);
  const C = Number(dim.C || 0);
  const D = Number(dim.D || 0);

  const widthAvg = (A + B) / 2;
  const depthAvg = (C + D) / 2;

  if (widthAvg <= 0 || depthAvg <= 0) {
    return 0;
  }

  if (shape === "SQUARE") {
    return Number((A * A).toFixed(2));
  }

  return Number((widthAvg * depthAvg).toFixed(2));
}

export function computeAutoOppositeDimension(
  dimensions: PlotDimensions,
  targetSide: PlotSide,
  knownArea?: number
): PlotDimensions {
  const next = { ...dimensions };
  
  if (targetSide === "B" && next.A > 0) next.B = next.A;
  else if (targetSide === "A" && next.B > 0) next.A = next.B;
  else if (targetSide === "D" && next.C > 0) next.D = next.C;
  else if (targetSide === "C" && next.D > 0) next.C = next.D;

  return next;
}