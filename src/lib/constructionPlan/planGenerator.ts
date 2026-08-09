/* =========================================================
CONSTRUCTION PLAN SYSTEM — MASTER PLAN GENERATOR
---------------------------------------------------------
Coordinates all modular engines (Plot, Setback, Floor, 
Elevation, Section, CAD, and Sheet) into a single payload.
========================================================= */

import { ConstructionPlanPayload, PlotShape } from "./types";
import { calculatePlotArea } from "./plotEngine";
import { calculateSetbacks } from "./setbackRules";
import { calculateBuildableFootprint } from "./layoutEngine";
import { calculateElevationProfile } from "./elevationEngine";
import { calculateSectionProfile } from "./sectionEngine";
import { prepareSheetLayout } from "./sheetEngine";

export function generateCompleteConstructionPlan(payload: any) {
  // Safe extraction or fallback if payload or dimensions is missing
  const dimensions = payload?.dimensions || { A: 30, B: 30, C: 40, D: 40 };
  const plotShape = (payload?.plot_shape || "RECTANGLE") as PlotShape;
  const roadSide = typeof payload?.road_side === "string" ? payload.road_side : "";
  const selectedFloors = payload?.selected_floors || ["GROUND FLOOR", "FIRST FLOOR"];

  const plotArea = calculatePlotArea(dimensions, plotShape);
  const setbacks = calculateSetbacks(plotArea, 20, roadSide.includes("CORNER"));
  const footprint = calculateBuildableFootprint(dimensions, setbacks);
  
  const elevation = calculateElevationProfile(selectedFloors);
  const section = calculateSectionProfile(selectedFloors);
  const sheetLayout = prepareSheetLayout(payload || {});

  return {
    plotArea,
    setbacks,
    footprint,
    elevation,
    section,
    sheetLayout,
  };
}