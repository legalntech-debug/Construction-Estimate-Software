// src/app/(dashboard)/reopen-old-case/components/handleConstructionPlanReopen.ts
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export interface HandleConstructionPlanReopenArgs {
  record: any;
  router: AppRouterInstance;
}

export function handleConstructionPlanReopen({
  record,
  router,
}: HandleConstructionPlanReopenArgs): void {
  if (!record) {
    console.warn("[CONSTRUCTION-PLAN REOPEN] No record provided");
    return;
  }

  console.log("[CONSTRUCTION-PLAN REOPEN] Case detected:", record.ref_no);

  const snapshot = record.form_snapshot || {};

  const constructionPlanData = {
    ref_no: record.ref_no,
    refNo: record.ref_no,

    selectedClientName:
      record.client_name || snapshot.selectedClientName || "",
    clientName: record.client_name || snapshot.clientName || "",
    representative:
      record.representative || snapshot.representative || "",
    customerName:
      record.customer_name || snapshot.customerName || "",
    propertyAddress:
      record.property_address || snapshot.propertyAddress || "",
    caseType: "CONSTRUCTION PLAN",

    plotArea:
      Number(record.plot_area) || Number(snapshot.plotArea) || 0,
    plotShape: snapshot.plotShape || "",
    roadFacingOption:
      record.road_side || snapshot.roadFacingOption || "",
    parkingSide: snapshot.parkingSide || "SOUTH",
    coverageType: snapshot.coverageType || "100_PERCENT",

    plotDimensions: snapshot.plotDimensions || {},
    dimDetails: snapshot.dimDetails || {},
    dimensions: snapshot.dimensions || {},
    setbackInputs:
      snapshot.setbackInputs || { front: 0, rear: 0, left: 0, right: 0 },

    boundaries: {
      north:
        record.boundary_north || snapshot.boundaries?.north || "",
      south:
        record.boundary_south || snapshot.boundaries?.south || "",
      east: record.boundary_east || snapshot.boundaries?.east || "",
      west: record.boundary_west || snapshot.boundaries?.west || "",
    },

    selectedFloors:
      Array.isArray(snapshot.selectedFloors) &&
      snapshot.selectedFloors.length > 0
        ? snapshot.selectedFloors
        : ["GROUND FLOOR"],
    floorData: record.floor_details || snapshot.floorData || {},
    floorRooms: snapshot.floorRooms || {},
    floorBhkConfig: snapshot.floorBhkConfig || {},
    floorBuiltUpAreas: snapshot.floorBuiltUpAreas || {},

    planningMode: snapshot.planningMode || "AUTO",
    floorSettings: snapshot.floorSettings || {},
    measurementUnit: snapshot.measurementUnit || "FEET",
    totalFloors: snapshot.totalFloors || 1,

    roadWidthNorth: snapshot.roadWidthNorth || 20,
    roadWidthSouth: snapshot.roadWidthSouth || 15,
    roadWidthEast: snapshot.roadWidthEast || 15,
    roadWidthWest: snapshot.roadWidthWest || 15,

    frontMos: record.front_mos || snapshot.frontMos || 0,
    rearMos: record.rear_mos || snapshot.rearMos || 0,
    leftMos: record.left_mos || snapshot.leftMos || 0,
    rightMos: record.right_mos || snapshot.rightMos || 0,

    groundStairPosition: snapshot.groundStairPosition || null,
    groundStairRelativeOffset:
      snapshot.groundStairRelativeOffset || null,
    groundFloorProgram: snapshot.groundFloorProgram || [],

    feeMode: record.fee_mode || snapshot.feeMode || "AUTO",
    feeAmount: record.user_payment || record.gateway_fee || 0,
    registeredFee: record.gateway_fee || 0,
    isReopenedCase: true,
  };

  try {
    const serialized = JSON.stringify(constructionPlanData);
    localStorage.setItem("constructionPlanData", serialized);
    localStorage.setItem("construction_plan_preview_data", serialized);
    localStorage.setItem("CONSTRUCTION_PLAN_INPUT", serialized);

    // ✅ CRITICAL FIX — Reopen flag + Ref No.
    if (record.ref_no) {
      localStorage.setItem("constructionPlanRefNo", record.ref_no);
      localStorage.setItem("constructionPlanReopen", "true");
      console.log(
        "[CONSTRUCTION-PLAN REOPEN] ✅ Ref No. + Reopen flag saved:",
        record.ref_no
      );
    } else {
      console.warn(
        "[CONSTRUCTION-PLAN REOPEN] ⚠️ record.ref_no missing"
      );
    }

    console.log("[CONSTRUCTION-PLAN REOPEN] ✅ Data saved to localStorage");
  } catch (e) {
    console.error(
      "[CONSTRUCTION-PLAN REOPEN] Failed to save localStorage:",
      e
    );
  }

  router.push("/construction-plan");
}