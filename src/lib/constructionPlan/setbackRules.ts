/* =========================================================
CONSTRUCTION PLAN SYSTEM — SETBACK & COVERAGE RULES
---------------------------------------------------------
Calculates statutory setbacks and max building coverage 
based on plot area, road width, and local building bye-laws.
========================================================= */

import { SetbackRuleset } from "./types";

export function calculateSetbacks(
  plotArea: number,
  roadWidthFeet: number = 20,
  isCornerPlot: boolean = false
): SetbackRuleset {
  // Default residential baseline setbacks (Configurable according to local DCR / Bye-laws)
  let frontSetback = 5; // feet
  let rearSetback = 3;
  let leftSetback = 0;
  let rightSetback = 0;
  let maxCoveragePercentage = 75; // 75% max coverage standard
  let maxBuildingHeight = 40; // feet

  if (plotArea > 1500) {
    frontSetback = 8;
    rearSetback = 5;
    leftSetback = 3;
  }

  if (plotArea > 3000) {
    frontSetback = 10;
    rearSetback = 6;
    leftSetback = 5;
    rightSetback = 3;
  }

  if (roadWidthFeet > 30) {
    frontSetback += 2;
  }

  return {
    frontSetback,
    rearSetback,
    leftSetback: isCornerPlot ? Math.max(leftSetback, 4) : leftSetback,
    rightSetback,
    maxCoveragePercentage,
    maxBuildingHeight,
  };
}