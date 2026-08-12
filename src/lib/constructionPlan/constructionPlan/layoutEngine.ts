import { BuildableGeometry, PlotDimensions, Polygon, SetbackRuleset } from "./types";
import { createPlotGeometry } from "./plotEngine";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Phase-1 buildable geometry for the supported axis-aligned plot workflow.
 * It is intentionally deterministic: front/rear/left/right are applied to
 * the plot bounding box. Polygon-specific offset geometry will be added in the
 * irregular-plot editor phase without changing this API.
 */
export function calculateBuildableGeometry(
  dimensions: PlotDimensions,
  shape: Parameters<typeof createPlotGeometry>[1],
  setbacks: SetbackRuleset,
  vertices?: Polygon
): BuildableGeometry {
  const plot = createPlotGeometry(dimensions, shape, vertices);
  const s = {
    front: Math.max(0, setbacks.frontSetback),
    rear: Math.max(0, setbacks.rearSetback),
    left: Math.max(0, setbacks.leftSetback),
    right: Math.max(0, setbacks.rightSetback),
  };
  const warnings = [...plot.errors];

  if (!plot.valid) {
    return { plot, buildablePolygon: [], buildableArea: 0, coveragePercentage: 0, setbacks: s, warnings };
  }

  const minX = Math.min(...plot.vertices.map((p) => p.x));
  const maxX = Math.max(...plot.vertices.map((p) => p.x));
  const minY = Math.min(...plot.vertices.map((p) => p.y));
  const maxY = Math.max(...plot.vertices.map((p) => p.y));
  const width = maxX - minX;
  const depth = maxY - minY;

  const buildableWidth = clamp(width - s.left - s.right, 0, width);
  const buildableDepth = clamp(depth - s.front - s.rear, 0, depth);
  const buildablePolygon: Polygon = [
    { x: minX + s.left, y: minY + s.front },
    { x: minX + s.left + buildableWidth, y: minY + s.front },
    { x: minX + s.left + buildableWidth, y: minY + s.front + buildableDepth },
    { x: minX + s.left, y: minY + s.front + buildableDepth },
  ];

  // The rectangle footprint is bounded by the plot geometry. For 100% coverage
  // with zero setbacks, preserve the exact original polygon.
  const useFullPlot = s.front === 0 && s.rear === 0 && s.left === 0 && s.right === 0;
  const finalPolygon = useFullPlot ? plot.vertices : buildablePolygon;
  const buildableArea = useFullPlot
    ? plot.area
    : Number((buildableWidth * buildableDepth).toFixed(2));

  if (!useFullPlot && buildableArea <= 0) warnings.push("Setbacks leave no buildable footprint.");
  if (!useFullPlot && buildableArea > plot.area + 0.01) warnings.push("Buildable area cannot exceed plot area.");

  return {
    plot,
    buildablePolygon: finalPolygon,
    buildableArea,
    coveragePercentage: plot.area > 0 ? Number(((buildableArea / plot.area) * 100).toFixed(2)) : 0,
    setbacks: s,
    warnings,
  };
}

export type BuildableFootprint = {
  width: number;
  length: number;
  buildableArea: number;
  originX: number;
  originY: number;
};

/** Backward-compatible adapter for the existing UI. */
export function calculateBuildableFootprint(
  dimensions: PlotDimensions,
  setbacks: SetbackRuleset
): BuildableFootprint {
  const effectiveWidth = Math.max(0, Number(dimensions.A || 0) - setbacks.leftSetback - setbacks.rightSetback);
  const effectiveLength = Math.max(0, Number(dimensions.C || 0) - setbacks.frontSetback - setbacks.rearSetback);
  return {
    width: effectiveWidth,
    length: effectiveLength,
    buildableArea: Number((effectiveWidth * effectiveLength).toFixed(2)),
    originX: setbacks.leftSetback,
    originY: setbacks.frontSetback,
  };
}
