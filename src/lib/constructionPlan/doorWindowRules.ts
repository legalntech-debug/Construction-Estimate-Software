/* =========================================================
CONSTRUCTION PLAN SYSTEM — DOOR & WINDOW RULES ENGINE
---------------------------------------------------------
Calculates ventilation, door counts, and window openings
based on built-up area and residential floor distribution.
========================================================= */

import { DoorWindowSpec } from "./types";

export function calculateDoorsAndWindows(
  totalBuiltUpArea: number,
  floorCount: number,
  hasTower: boolean
): DoorWindowSpec {
  if (floorCount <= 0) {
    return { mainDoors: 0, internalDoors: 0, bathroomDoors: 0, windows: 0, ventilators: 0 };
  }

  // Baseline estimation logic aligned with architectural standards
  let baseCount = 4 * floorCount;

  if (totalBuiltUpArea > 600) {
    baseCount = 5 * floorCount;
  }
  if (totalBuiltUpArea > 1000) {
    baseCount = 6 * floorCount;
  }
  if (totalBuiltUpArea > 1500) {
    baseCount = 8 * floorCount;
  }
  if (totalBuiltUpArea > 2000) {
    baseCount = 8 + Math.ceil((totalBuiltUpArea - 2000) / 500);
  }
  if (hasTower) {
    baseCount += 1;
  }

  const mainDoors = floorCount; // Generally 1 main entrance per floor/unit
  const bathroomDoors = Math.max(floorCount * 2, 2);
  const internalDoors = Math.max(0, baseCount - mainDoors - bathroomDoors);
  
  const windows = baseCount * 2;
  const ventilators = bathroomDoors;

  return {
    mainDoors,
    internalDoors,
    bathroomDoors,
    windows,
    ventilators,
  };
}