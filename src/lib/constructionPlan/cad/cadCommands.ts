/* =========================================================
CONSTRUCTION PLAN SYSTEM — CAD RENDERER ENGINE
---------------------------------------------------------
Generates vector CAD lines, walls, doors, and room partitions
for the architectural drawing preview.
========================================================= */

import { PlotDimensions } from "../types";

export function generateCadVectorBlueprint(dimensions: PlotDimensions, footprint: any) {
  const width = Number(dimensions?.A || 30);
  const depth = Number(dimensions?.C || 40);

  // SVG scaling coordinates based on plot dimensions
  return {
    viewBox: `0 0 ${width * 10} ${depth * 10}`,
    outerBoundary: {
      x: 10,
      y: 10,
      width: width * 10 - 20,
      height: depth * 10 - 20,
    },
    rooms: [
      { name: "HALL / LIVING", x: 20, y: 20, w: (width * 10) / 2 - 30, h: (depth * 10) / 2 - 30 },
      { name: "BEDROOM", x: (width * 10) / 2, y: 20, w: (width * 10) / 2 - 30, h: (depth * 10) / 2 - 30 },
      { name: "KITCHEN", x: 20, y: (depth * 10) / 2, w: (width * 10) / 2 - 30, h: (depth * 10) / 2 - 30 },
      { name: "TOILET / OPEN", x: (width * 10) / 2, y: (depth * 10) / 2, w: (width * 10) / 2 - 30, h: (depth * 10) / 2 - 30 },
    ],
  };
}