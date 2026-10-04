// src/app/(dashboard)/reopen-old-case/components/handleConstructionPlanReopen.ts

/**
 * Handle reopen for CONSTRUCTION_PLAN case type.
 *
 * Ye function `reopen-old-case/page.tsx` ke `handleReopen` se call hota hai
 * jab record ka case_type CONSTRUCTION_PLAN ho.
 *
 * Kaam:
 *  1. Record se + form_snapshot se saara data collect karta hai
 *  2. localStorage mein 3 keys set karta hai (input + preview compatibility)
 *  3. `/construction-plan` par redirect karta hai
 *
 * IMPORTANT: Ye sirf CONSTRUCTION_PLAN ke liye hai.
 * Deed Draft / Estimate / Renovation ke liye ALAG branches hain page.tsx mein.
 */

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

  // ============================================================
  // Collect all data (record fields → fallback to snapshot fields)
  // ============================================================
  const constructionPlanData = {
    // ---------- Identity ----------
    ref_no: record.ref_no,
    refNo: record.ref_no,

    // ---------- Client / Customer ----------
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

    // ---------- Plot ----------
    plotArea:
      Number(record.plot_area) || Number(snapshot.plotArea) || 0,
    plotShape: snapshot.plotShape || "",
    roadFacingOption:
      record.road_side || snapshot.roadFacingOption || "",
    parkingSide: snapshot.parkingSide || "SOUTH",
    coverageType: snapshot.coverageType || "100_PERCENT",

    // ---------- Dimensions ----------
    plotDimensions: snapshot.plotDimensions || {},
    dimDetails: snapshot.dimDetails || {},
    dimensions: snapshot.dimensions || {},
    setbackInputs:
      snapshot.setbackInputs || { front: 0, rear: 0, left: 0, right: 0 },

    // ---------- Boundaries ----------
    boundaries: {
      north:
        record.boundary_north || snapshot.boundaries?.north || "",
      south:
        record.boundary_south || snapshot.boundaries?.south || "",
      east: record.boundary_east || snapshot.boundaries?.east || "",
      west: record.boundary_west || snapshot.boundaries?.west || "",
    },

    // ---------- Floors ----------
    selectedFloors:
      Array.isArray(snapshot.selectedFloors) &&
      snapshot.selectedFloors.length > 0
        ? snapshot.selectedFloors
        : ["GROUND FLOOR"],
    floorData: record.floor_details || snapshot.floorData || {},
    floorRooms: snapshot.floorRooms || {},
    floorBhkConfig: snapshot.floorBhkConfig || {},
    floorBuiltUpAreas: snapshot.floorBuiltUpAreas || {},

    // ---------- Planning ----------
    planningMode: snapshot.planningMode || "AUTO",
    floorSettings: snapshot.floorSettings || {},
    measurementUnit: snapshot.measurementUnit || "FEET",
    totalFloors: snapshot.totalFloors || 1,

    // ---------- Road widths ----------
    roadWidthNorth: snapshot.roadWidthNorth || 20,
    roadWidthSouth: snapshot.roadWidthSouth || 15,
    roadWidthEast: snapshot.roadWidthEast || 15,
    roadWidthWest: snapshot.roadWidthWest || 15,

    // ---------- MOS ----------
    frontMos: record.front_mos || snapshot.frontMos || 0,
    rearMos: record.rear_mos || snapshot.rearMos || 0,
    leftMos: record.left_mos || snapshot.leftMos || 0,
    rightMos: record.right_mos || snapshot.rightMos || 0,

    // ---------- Stair ----------
    groundStairPosition: snapshot.groundStairPosition || null,
    groundStairRelativeOffset:
      snapshot.groundStairRelativeOffset || null,
    groundFloorProgram: snapshot.groundFloorProgram || [],

    // ---------- Meta ----------
    feeMode: record.fee_mode || snapshot.feeMode || "AUTO",
    feeAmount: record.user_payment || record.gateway_fee || 0,
    registeredFee: record.gateway_fee || 0,
    isReopenedCase: true,
  };

  // ============================================================
  // Save to localStorage (3 keys — input + preview both read these)
  // ============================================================
  try {
    const serialized = JSON.stringify(constructionPlanData);
    localStorage.setItem("constructionPlanData", serialized);
    localStorage.setItem(
      "construction_plan_preview_data",
      serialized
    );
    localStorage.setItem("CONSTRUCTION_PLAN_INPUT", serialized);

    console.log(
      "[CONSTRUCTION-PLAN REOPEN] ✅ Data saved to localStorage"
    );
  } catch (e) {
    console.error(
      "[CONSTRUCTION-PLAN REOPEN] Failed to save localStorage:",
      e
    );
  }

  // ============================================================
  // Redirect to construction plan input page
  // ============================================================
  router.push("/construction-plan");
}