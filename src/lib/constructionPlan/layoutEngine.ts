/* =========================================================
CONSTRUCTION PLAN SYSTEM — LAYOUT ENGINE
---------------------------------------------------------
Coordinates plot boundaries, setbacks, road orientation, 
and room priority queues to establish buildable footprints.
========================================================= */

import { PlotDimensions, SetbackRuleset } from "./types";

export type BuildableFootprint = {
  width: number;
  length: number;
  buildableArea: number;
  originX: number;
  originY: number;
};

export function calculateBuildableFootprint(
  dimensions: PlotDimensions,
  setbacks: SetbackRuleset
): BuildableFootprint {
  const effectiveWidth = Math.max(0, dimensions.A - setbacks.leftSetback - setbacks.rightSetback);
  const effectiveLength = Math.max(0, dimensions.C - setbacks.frontSetback - setbacks.rearSetback);
  
  const buildableArea = Number((effectiveWidth * effectiveLength).toFixed(2));

  return {
    width: effectiveWidth,
    length: effectiveLength,
    buildableArea,
    originX: setbacks.leftSetback,
    originY: setbacks.frontSetback,
  };
}