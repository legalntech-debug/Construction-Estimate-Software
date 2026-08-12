import { PlotDimensions, PlotShape, Polygon, PlotGeometry } from "./types";

export function calculatePlotArea(dimensions: PlotDimensions, shape: PlotShape | "IRREGULAR"): number {
  const A = Number(dimensions.A) || 0;
  const B = Number(dimensions.B) || 0;
  const C = Number(dimensions.C) || 0;
  const D = Number(dimensions.D) || 0;
  const E = Number(dimensions.E) || 0;
  const F = Number(dimensions.F) || 0;

  if (shape === "SQUARE" || shape === "RECTANGULAR") {
    return Number((A * C).toFixed(2));
  }
  
  if (shape === "TRAPEZOIDAL") {
    const avgWidth = (A + B) / 2;
    const avgDepth = (C + D) / 2;
    return Number((avgWidth * avgDepth).toFixed(2));
  }

  if (shape === "IRREGULAR" || shape === "POLYGON") {
    const avgWidth = (A + B) / 2;
    const avgDepth = (C + D) / 2;
    const baseArea = avgWidth * avgDepth;
    const extraArea = E > 0 && F > 0 ? E * F : 0;
    return Number(Math.max(0, baseArea + extraArea).toFixed(2));
  }

  if (shape.includes("L-SHAPE")) {
    const totalRect = A * C;
    const cutArea = E * F;
    if (shape.includes("TYPE 1") || shape.includes("TYPE 2") || shape.includes("TYPE 3") || shape.includes("TYPE 4")) {
      return Number(Math.max(0, totalRect - cutArea).toFixed(2));
    }
    return Number(totalRect.toFixed(2));
  }

  return Number((A * C).toFixed(2));
}

export function getPlotBoundaryCoordinates(
  plotDimensions: PlotDimensions,
  plotShape: PlotShape | "IRREGULAR",
  baseCenterX: number,
  baseY: number
) {
  const scale = 8;
  const rawA = Number(plotDimensions.A) || 30;
  const rawB = Number(plotDimensions.B) || 15;
  const rawC = Number(plotDimensions.C) || 60;
  const rawD = Number(plotDimensions.D) || 35;
  const rawE = Number(plotDimensions.E) || 15;
  const rawF = Number(plotDimensions.F) || 35;

  const dimA = rawA * scale;
  const dimB = rawB * scale;
  const dimC = rawC * scale;
  const dimD = rawD * scale;
  const dimE = rawE * scale;
  const dimF = rawF * scale;

  let plotPoints: { x: number; y: number }[] = [];

  if (plotShape === "L-SHAPE (TYPE 1: FRONT-LEFT CUT)") {
    const startX = baseCenterX - dimA / 2;
    const startY = baseY - dimC;

    plotPoints = [
      { x: startX + dimE, y: startY },
      { x: startX + dimA, y: startY },
      { x: startX + dimA, y: baseY },
      { x: startX, y: baseY },
      { x: startX, y: baseY - dimD },
      { x: startX + dimE, y: baseY - dimD },
    ];
  } else if (plotShape === "L-SHAPE (TYPE 2: FRONT-RIGHT CUT)") {
    const startX = baseCenterX - dimA / 2;
    const startY = baseY - dimC;

    plotPoints = [
      { x: startX, y: startY },
      { x: startX + dimA - dimE, y: startY },
      { x: startX + dimA - dimE, y: startY + dimF },
      { x: startX + dimA, y: startY + dimF },
      { x: startX + dimA, y: baseY },
      { x: startX, y: baseY },
    ];
  } else if (plotShape === "L-SHAPE (TYPE 3: REAR-LEFT CUT)") {
    const startX = baseCenterX - dimA / 2;
    const startY = baseY - dimC;

    plotPoints = [
      { x: startX + dimE, y: startY },
      { x: startX + dimA, y: startY },
      { x: startX + dimA, y: baseY },
      { x: startX, y: baseY },
      { x: startX, y: startY + dimF },
      { x: startX + dimE, y: startY + dimF },
    ];
  } else if (plotShape === "L-SHAPE (TYPE 4: REAR-RIGHT CUT)") {
    const startX = baseCenterX - dimA / 2;
    const startY = baseY - dimC;

    plotPoints = [
      { x: startX, y: startY },
      { x: startX + dimA - dimE, y: startY },
      { x: startX + dimA - dimE, y: startY + dimF },
      { x: startX + dimA, y: startY + dimF },
      { x: startX + dimA, y: baseY },
      { x: startX, y: baseY },
    ];
  } else if (plotShape === "IRREGULAR" || plotShape === "TRAPEZOIDAL") {
    plotPoints = [
      { x: baseCenterX - dimB / 2, y: baseY - dimC },
      { x: baseCenterX + dimB / 2, y: baseY - dimD },
      { x: baseCenterX + dimA / 2 + (dimE > 0 ? dimE / 2 : 0), y: baseY },
      { x: baseCenterX - dimA / 2 - (dimF > 0 ? dimF / 2 : 0), y: baseY },
    ];
  } else {
    // Standard RECTANGULAR & SQUARE handling ensuring Side A (Front Width) is at bottom/top based on alignment
    const halfWidthA = dimA / 2;
    const halfWidthB = dimB / 2;
    const depthC = dimC;
    const depthD = dimD;

    plotPoints = [
      { x: baseCenterX - halfWidthB, y: baseY - depthC }, // Top-Left (Rear)
      { x: baseCenterX + halfWidthB, y: baseY - depthD }, // Top-Right (Rear)
      { x: baseCenterX + halfWidthA, y: baseY },           // Bottom-Right (Front)
      { x: baseCenterX - halfWidthA, y: baseY },           // Bottom-Left (Front)
    ];
  }

  const xs = plotPoints.map((p) => p.x);
  const ys = plotPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    plotPoints,
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    rawDimensions: { rawA, rawB, rawC, rawD, rawE, rawF },
  };
}

export function createPlotGeometry(dimensions: PlotDimensions, shape: PlotShape | "IRREGULAR", vertices?: Polygon): PlotGeometry {
  const A = Number(dimensions.A) || 30;
  const C = Number(dimensions.C) || 60;
  
  const plotVertices = vertices && vertices.length > 0 ? vertices : [
    { x: 0, y: 0 },
    { x: A, y: 0 },
    { x: A, y: C },
    { x: 0, y: C },
  ];

  const area = calculatePlotArea(dimensions, shape);
  const width = Number(dimensions.A) || 30;
  const depth = Number(dimensions.C) || 60;
  const perimeter = Number((2 * (width + depth)).toFixed(2));

  return {
    valid: true,
    shape: shape as PlotShape,
    vertices: plotVertices,
    area,
    perimeter,
    width,
    depth,
    errors: [],
  };
}