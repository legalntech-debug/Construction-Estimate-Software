/* =========================================================
CONSTRUCTION PLAN SYSTEM — 80:20 SHEET ENGINE
---------------------------------------------------------
Organizes the final output layout into 80% drawing space 
and 20% area statement & professional metadata sidebar.
========================================================= */

import { ConstructionPlanPayload } from "./planningTypes";

export type SheetLayoutConfig = {
  drawingAreaPercentage: number; // 80%
  sidebarPercentage: number;      // 20%
  metadata: {
    customerName: string;
    propertyAddress: string;
    totalPlotArea: number;
    totalBuiltUpArea: number;
    totalRoomsArea: number;
  };
};

export function prepareSheetLayout(payload: ConstructionPlanPayload): SheetLayoutConfig {
  return {
    drawingAreaPercentage: 80,
    sidebarPercentage: 20,
    metadata: {
      customerName: payload.customer_name,
      propertyAddress: payload.property_address,
      totalPlotArea: payload.plot_area,
      totalBuiltUpArea: payload.total_builtup_area,
      totalRoomsArea: payload.total_room_area,
    },
  };
}