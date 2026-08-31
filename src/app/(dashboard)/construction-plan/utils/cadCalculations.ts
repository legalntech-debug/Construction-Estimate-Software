import { PlotDimensions, PlotShape } from "../engine/planningTypes";

export function sortFloors(floors: string[], floorSequence: string[]): string[] {
  return [...floors].sort(
    (a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b)
  );
}

export function calculatePlotDimensionsState(previous: PlotDimensions, side: keyof PlotDimensions, field: "ft" | "in", val: number, currentDimDetails: Record<string, { ft: number; in: number }>) {
  const current = currentDimDetails[side] || { ft: 0, in: 0 };
  const updatedPart = { ...current, [field]: Math.max(0, val) };
  let totalValue = Number((updatedPart.ft + updatedPart.in / 12).toFixed(2));
  let updatedDims = { ...previous, [side]: totalValue };
  return { updatedDims, updatedPart };
}