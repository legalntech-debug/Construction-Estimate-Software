/* =========================================================
CONSTRUCTION PLAN SYSTEM — STAIRCASE RULES ENGINE
========================================================= */

import { StaircaseSpec } from "./planningTypes";

// ✅ STRAIGHT completely removed
export type StaircaseType =
  | "DOG_LEGGED"
  | "L_SHAPED"
  | "2_QUARTER_WINDER"    // ✅ C-Shape with winders
  | "2_QUARTER_LANDING";  // ✅ C-Shape with landing

export interface StaircaseFootprint extends StaircaseSpec {
  staircaseType: StaircaseType;
  requiredWidthFt: number;
  requiredLengthFt: number;
  // ✅ NEW: Detailed flight breakdown
  flight1: { treads: number; riserCount: number; lengthFt: number };
  flight2: { treads: number; riserCount: number; lengthFt: number };
  landing1: { widthFt: number; lengthFt: number };
  landing2: { widthFt: number; lengthFt: number };
  middleTreads: number;
  wellSize: { widthFt: number; lengthFt: number };
  totalRiseInches: number;
  totalTreadDepthInches: number;
}

/**
 * ✅ DYNAMIC STAIRCASE CALCULATOR
 *
 * @param floorToFloorHeightFt — Total floor height (default 10 ft)
 * @param availableWidthFt — Available width for stair (from wall to wall)
 * @param availableLengthFt — Available length for stair
 * @param staircaseType — Type of stair
 * @param preferredRiserIn — Preferred riser (default 7")
 * @param preferredTreadIn — Preferred tread (default 11")
 * @param flightWidthFt — Each flight width (default 3')
 */
export function calculateStaircase(
  floorToFloorHeightFt: number = 10,
  availableWidthFt: number = 10,
  availableLengthFt: number = 16,
  staircaseType: StaircaseType = "2_QUARTER_LANDING",
  preferredRiserIn: number = 7,
  preferredTreadIn: number = 11,
  flightWidthFt: number = 3.0
): StaircaseFootprint {
  const totalHeightInches = floorToFloorHeightFt * 12;

  // ============================================================
  // ✅ STEP 1: DYNAMIC RISER CALCULATION
  // ============================================================
  let riserCount = Math.round(totalHeightInches / preferredRiserIn);
  let actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));

  // Building code: 6" ≤ riser ≤ 7.5"
  if (actualRiserInches > 7.5) {
    riserCount = Math.ceil(totalHeightInches / 7.5);
    actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));
  } else if (actualRiserInches < 6) {
    riserCount = Math.floor(totalHeightInches / 6);
    actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));
  }

  // ============================================================
  // ✅ STEP 2: DYNAMIC TREAD CALCULATION (10" - 11")
  // ============================================================
  const treadInches = actualRiserInches < 6.5 ? 10
    : actualRiserInches < 7 ? 10.5
    : 11;

  // ============================================================
  // ✅ STEP 3: FLIGHT BREAKDOWN (2 flights)
  // ============================================================
  const risersPerFlight = Math.ceil(riserCount / 2);
  const treadsPerFlight = Math.max(2, risersPerFlight - 1);  // Top tread is landing

  const flight1LengthInches = treadsPerFlight * treadInches;
  const flight2LengthInches = treadsPerFlight * treadInches;

  const flight1LengthFt = Number((flight1LengthInches / 12).toFixed(2));
  const flight2LengthFt = Number((flight2LengthInches / 12).toFixed(2));

  // ============================================================
  // ✅ STEP 4: LANDING CALCULATION
  // ============================================================
  // Landing width = flight width (min 3 ft)
  const landing1WidthFt = Math.max(flightWidthFt, 3.0);
  const landing2WidthFt = Math.max(flightWidthFt, 3.0);

  // Landing length = flight width (square landing)
  const landing1LengthFt = landing1WidthFt;
  const landing2LengthFt = landing2WidthFt;

  // ============================================================
  // ✅ STEP 5: MIDDLE TREADS (only for 2_QUARTER_LANDING)
  // ============================================================
  let middleTreads = 0;
  let requiredLengthFt = 0;
  let requiredWidthFt = flightWidthFt * 2;

  if (staircaseType === "2_QUARTER_LANDING") {
    // 2 Quarter Landing = 2 flights + 2 landings + 3 middle treads
    middleTreads = 3;
    const middleTreadLengthInches = middleTreads * treadInches;
    const middleTreadLengthFt = middleTreadLengthInches / 12;

    requiredLengthFt = Number((
      flight1LengthFt + landing1LengthFt + middleTreadLengthFt + landing2LengthFt + flight2LengthFt
    ).toFixed(2));

    requiredWidthFt = Math.max(landing1WidthFt * 2, flightWidthFt * 2 + 3);
  } else if (staircaseType === "2_QUARTER_WINDER") {
    // 2 Quarter Winder = 2 flights + 1 winder (no middle treads)
    middleTreads = 0;
    requiredLengthFt = Number((
      flight1LengthFt + landing1LengthFt + flight2LengthFt
    ).toFixed(2));
    requiredWidthFt = Math.max(landing1WidthFt * 2, flightWidthFt * 2 + 3);
  } else if (staircaseType === "L_SHAPED") {
    // L-Shaped = 2 flights + 1 landing
    middleTreads = 0;
    requiredLengthFt = Number((
      flight1LengthFt + landing1LengthFt + flight2LengthFt
    ).toFixed(2));
    requiredWidthFt = flightWidthFt * 2;
  } else if (staircaseType === "DOG_LEGGED") {
    // Dog-legged = 2 flights + 1 landing (parallel)
    middleTreads = 0;
    requiredLengthFt = Number((
      flight1LengthFt + landing1LengthFt
    ).toFixed(2));
    requiredWidthFt = flightWidthFt * 2 + 0.5;
  }

  // ============================================================
  // ✅ STEP 6: WELL SIZE (Empty space)
  // ============================================================
  const wellWidthFt = Math.max(0, availableWidthFt - (landing1WidthFt * 2));
  const wellLengthFt = Math.max(0, availableLengthFt - requiredLengthFt);

  // ============================================================
  // ✅ STEP 7: STATUS
  // ============================================================
  let status: "OPTIMAL" | "COMPACT" | "CHECK REQUIRED" = "OPTIMAL";
  if (actualRiserInches > 7.5 || actualRiserInches < 6) {
    status = "CHECK REQUIRED";
  } else if (actualRiserInches > 7 || actualRiserInches < 6.5) {
    status = "COMPACT";
  }

  // ============================================================
  // ✅ RETURN
  // ============================================================
  return {
    floorToFloorHeight: floorToFloorHeightFt,
    targetRiserInches: preferredRiserIn,
    riserCount,
    actualRiserInches,
    treadInches,
    flightCount: 2,
    landingWidth: landing1WidthFt,
    staircaseWidth: flightWidthFt,
    totalLengthNeeded: requiredLengthFt,
    status,
    staircaseType,
    requiredWidthFt,
    requiredLengthFt,

    // ✅ NEW: Detailed breakdown
    flight1: {
      treads: treadsPerFlight,
      riserCount: risersPerFlight,
      lengthFt: flight1LengthFt,
    },
    flight2: {
      treads: treadsPerFlight,
      riserCount: risersPerFlight,
      lengthFt: flight2LengthFt,
    },
    landing1: {
      widthFt: landing1WidthFt,
      lengthFt: landing1LengthFt,
    },
    landing2: {
      widthFt: landing2WidthFt,
      lengthFt: landing2LengthFt,
    },
    middleTreads,
    wellSize: {
      widthFt: wellWidthFt,
      lengthFt: wellLengthFt,
    },
    totalRiseInches: riserCount * actualRiserInches,
    totalTreadDepthInches: (treadsPerFlight * 2 + middleTreads) * treadInches,
  };
}