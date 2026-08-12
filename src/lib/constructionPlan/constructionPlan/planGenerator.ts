import { ConstructionPlanPayload, PlotShape } from "./types";
import { calculatePlotArea, createPlotGeometry } from "./plotEngine";
import { calculateSetbacks } from "./setbackRules";
import { calculateBuildableGeometry, calculateBuildableFootprint } from "./layoutEngine";
import { calculateElevationProfile } from "./elevationEngine";
import { calculateSectionProfile } from "./sectionEngine";
import { prepareSheetLayout } from "./sheetEngine";

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function generateCompleteConstructionPlan(payload: Partial<ConstructionPlanPayload> | any) {
  const safePayload = payload || {};
  const dimensions = safePayload.dimensions || { A: 20, B: 20, C: 40, D: 40 };
  const plotShape = (safePayload.plot_shape || "RECTANGULAR") as PlotShape;
  const roadSide = typeof safePayload.road_side === "string" ? safePayload.road_side : "";
  const selectedFloors = Array.isArray(safePayload.selected_floors) && safePayload.selected_floors.length
    ? safePayload.selected_floors : ["GROUND FLOOR"];

  const plotGeometry = createPlotGeometry(dimensions, plotShape, safePayload.plot_vertices);
  const plotArea = safeNumber(safePayload.plot_area, plotGeometry.area || calculatePlotArea(dimensions, plotShape));

  const coverageType = safePayload.coverage_type || "AS_PER_NORMS";
  const setbacks = calculateSetbacks(
    plotArea,
    safeNumber(safePayload.road_width_feet, 20),
    roadSide.toUpperCase().includes("CORNER"),
    safePayload.setbacks,
    coverageType,
    safePayload.coverage_percentage,
  );

  // 100% coverage means the complete plot is the buildable footprint.
  const effectiveSetbacks = coverageType === "100_PERCENT"
    ? { ...setbacks, frontSetback: 0, rearSetback: 0, leftSetback: 0, rightSetback: 0 }
    : setbacks;

  const buildableGeometry = calculateBuildableGeometry(
    dimensions,
    plotShape,
    effectiveSetbacks,
    safePayload.plot_vertices,
  );
  const footprint = calculateBuildableFootprint(dimensions, effectiveSetbacks);

  const floorHeight = safeNumber(safePayload.floor_height_feet, 10);
  const elevation = calculateElevationProfile(selectedFloors, floorHeight);
  const section = calculateSectionProfile(selectedFloors, floorHeight);
  const sheetLayout = prepareSheetLayout({
    ...safePayload,
    plot_area: plotArea,
    total_builtup_area: safeNumber(safePayload.total_builtup_area, 0),
    total_room_area: safeNumber(safePayload.total_room_area, 0),
  } as ConstructionPlanPayload);

  return {
    plotArea,
    plotShape,
    dimensions,
    plotGeometry,
    roadSide,
    selectedFloors,
    setbacks: effectiveSetbacks,
    buildableGeometry,
    footprint,
    elevation,
    section,
    sheetLayout,
    floorDetails: safePayload.floor_details || {},
    roomDetails: safePayload.room_details || {},
    boundaries: safePayload.boundaries || {},
    coverageType,
  };
}
