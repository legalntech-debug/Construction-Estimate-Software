/* =========================================================
CONSTRUCTION PLAN SYSTEM — STAIRCASE RULES ENGINE
========================================================= */

import { StaircaseSpec } from "./planningTypes";

export type StaircaseType = "DOG_LEGGED" | "STRAIGHT" | "L_SHAPED";

export interface StaircaseFootprint extends StaircaseSpec {
  staircaseType: StaircaseType;
  requiredWidthFt: number;
  requiredLengthFt: number;
}

export function calculateStaircase(
  floorToFloorHeightFeet: number = 10,
  targetRiserInches: number = 7,
  staircaseType: StaircaseType = "DOG_LEGGED"
): StaircaseFootprint {
  const totalHeightInches = floorToFloorHeightFeet * 12;
  const riserCount = Math.round(totalHeightInches / targetRiserInches);
  const actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));
  const treadInches = 10;
  const landingWidth = 3.5;
  const flightWidth = 3.25;

  let flightCount = 2;
  let requiredWidthFt = flightWidth * 2;
  const stepsPerFlight = Math.ceil(riserCount / 2);
  let requiredLengthFt = Number(
    (((stepsPerFlight - 1) * treadInches) / 12 + landingWidth).toFixed(2)
  );

  if (staircaseType === "STRAIGHT") {
    flightCount = 1;
    requiredWidthFt = 3.5;
    const steps = riserCount - 1;
    requiredLengthFt = Number(((steps * treadInches) / 12 + landingWidth).toFixed(2));
  } else if (staircaseType === "L_SHAPED") {
    flightCount = 2;
    requiredWidthFt = 6.0;
  }

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
    staircaseWidth: flightWidth,
    totalLengthNeeded: requiredLengthFt,
    status,
    staircaseType,
    requiredWidthFt,
    requiredLengthFt,
  };
}