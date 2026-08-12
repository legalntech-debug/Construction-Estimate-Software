/* =========================================================
CONSTRUCTION PLAN SYSTEM — STAIRCASE RULES ENGINE
---------------------------------------------------------
Calculates intelligent stair design parameters including 
riser count, treads, flight distribution, and landing space.
========================================================= */

import { StaircaseSpec } from "./types";

export function calculateStaircase(
  floorToFloorHeightFeet: number = 10,
  targetRiserInches: number = 7
): StaircaseSpec {
  const totalHeightInches = floorToFloorHeightFeet * 12;
  const riserCount = Math.round(totalHeightInches / targetRiserInches);
  const actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));
  const treadInches = 10; // Standard residential tread
  const flightCount = riserCount > 18 ? 2 : 2; // Default to 2 flights for standard residential
  const landingWidth = 3.5; // feet
  const staircaseWidth = 3.5; // feet
  
  // Total horizontal length needed for one flight
  const stepsPerFlight = Math.ceil(riserCount / flightCount);
  const totalLengthNeeded = Number((((stepsPerFlight - 1) * treadInches) / 12 + landingWidth).toFixed(2));

  let status: "OPTIMAL" | "COMPACT" | "CHECK REQUIRED" = "OPTIMAL";
  if (actualRiserInches > 7.5 || actualRiserInches < 6) {
    status = "CHECK REQUIRED";
  }

  return {
    floorToFloorHeight: floorToFloorHeightFeet,
    targetRiserInches,
    riserCount,
    actualRiserInches,
    treadInches,
    flightCount,
    landingWidth,
    staircaseWidth,
    totalLengthNeeded,
    status,
  };
}