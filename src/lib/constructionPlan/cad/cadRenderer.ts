/* =========================================================
CONSTRUCTION PLAN SYSTEM — UNIFIED PLOT BOUNDARY CAD ENGINE
---------------------------------------------------------
Renders professional architectural blueprints with 
8" external walls, 4" internal partitions, light hatching,
clean parking text, and a designated entrance gate opening.
========================================================= */

import { PlotDimensions } from "../types";

export function generateCadVectorBlueprint(dimensions: PlotDimensions, footprint: any, floorDetails?: any) {
  const width = Number(dimensions?.A || 20);
  const depth = Number(dimensions?.C || 40);

  const scale = 7.5; 
  const plotW = width * scale * 2;
  const plotD = depth * scale * 2;

  const viewBox = `0 0 ${plotW + 40} ${plotD + 40}`;

  return {
    viewBox,
    plotWidth: plotW,
    plotDepth: plotD,
    
    sitePlan: {
      boundary: { x: 20, y: 20, width: plotW, height: plotD },
      topNeighbor: "SHRI HARI KUMAWAT HOUSE",
      leftNeighbor: "PAVITRA SHARMA HOUSE",
    },

    getRoomsForFloor: (floorName: string) => {
      const isGround = floorName.toLowerCase().includes("ground");
      const fData = floorDetails?.[floorName] || {};
      const floorArea = Number(fData.area || (width * depth));

      if (isGround) {
        return [
          { name: "OUTER_BOUNDARY", x: 20, y: 20, w: plotW, h: plotD, isBoundary: true, wallThickness: 6, gateOpening: true },
          { name: "BEDROOM", area: `${Math.round(floorArea * 0.25)} SQ.FT`, x: 20, y: 20, w: plotW * 0.55, h: plotD * 0.40, hasDoor: true, doorX: 20 + (plotW * 0.27), doorY: 20 + plotD * 0.40 },
          { name: "BATHROOM", area: "40 SQ.FT", x: 20 + plotW * 0.55, y: 20, w: plotW * 0.45, h: plotD * 0.20, hasDoor: true, doorX: 20 + plotW * 0.75, doorY: 20 + plotD * 0.20 },
          { name: "HALL", area: `${Math.round(floorArea * 0.3)} SQ.FT`, x: 20 + plotW * 0.55, y: 20 + plotD * 0.20, w: plotW * 0.45, h: plotD * 0.45, hasDoor: true, doorX: 20 + plotW * 0.55, doorY: 20 + plotD * 0.35 },
          { name: "KITCHEN CUM DINING", area: `${Math.round(floorArea * 0.25)} SQ.FT`, x: 20, y: 20 + plotD * 0.40, w: plotW * 0.55, h: plotD * 0.35, hasWindow: true, hasDoor: true, doorX: 20 + plotW * 0.55, doorY: 20 + plotD * 0.55 },
          { name: "STAIRCASE", area: "UP", x: 20, y: 20 + plotD * 0.75, w: plotW * 0.45, h: plotD * 0.25, isStairs: true },
          { name: "PARKING", area: "PARKING", x: 20 + plotW * 0.45, y: 20 + plotD * 0.65, w: plotW * 0.55, h: plotD * 0.35, isParking: true },
        ];
      } else {
        return [
          { name: "OUTER_BOUNDARY", x: 20, y: 20, w: plotW, h: plotD, isBoundary: true, wallThickness: 6 },
          { name: "LIVING / HALL", area: `${Math.round(floorArea * 0.4)} SQ.FT`, x: 20, y: 20, w: plotW, h: plotD * 0.35, wallThickness: 2, hasDoor: true, doorX: 20 + plotW * 0.5, doorY: 20 + plotD * 0.35 },
          { name: "KITCHEN (SE)", area: `${Math.round(floorArea * 0.2)} SQ.FT`, x: 20, y: 20 + plotD * 0.35, w: plotW * 0.5, h: plotD * 0.35, wallThickness: 2, hasDoor: true, doorX: 20 + plotW * 0.5, doorY: 20 + plotD * 0.45 },
          { name: "STAIRCASE", area: "UP", x: 20 + plotW * 0.5, y: 20 + plotD * 0.35, w: plotW * 0.5, h: plotD * 0.35, isStairs: true, wallThickness: 2 },
          { name: "BEDROOM (SW)", area: `${Math.round(floorArea * 0.25)} SQ.FT`, x: 20, y: 20 + plotD * 0.70, w: plotW * 0.6, h: plotD * 0.30, wallThickness: 2, hasDoor: true, doorX: 20 + plotW * 0.5, doorY: 20 + plotD * 0.70 },
          { name: "BATHROOM", area: `${Math.round(floorArea * 0.15)} SQ.FT`, x: 20 + plotW * 0.6, y: 20 + plotD * 0.70, w: plotW * 0.4, h: plotD * 0.30, wallThickness: 2, hasDoor: true, doorX: 20 + plotW * 0.6, doorY: 20 + plotD * 0.85 },
        ];
      }
    }
  };
}