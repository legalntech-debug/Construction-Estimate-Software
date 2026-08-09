/* =========================================================
CONSTRUCTION PLAN SYSTEM — FLOOR VALIDATION ENGINE
---------------------------------------------------------
Validates floor areas against plot dimensions, room totals,
and statutory/minimum area rules before plan generation.
========================================================= */

import { FloorData, FloorRoom } from "./types";
import { getRoomDefinition } from "./roomRules";

export type ValidationError = {
  floor: string;
  roomKey?: string;
  message: string;
};

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
};

export function validateConstructionPlan(
  plotArea: number,
  selectedFloors: string[],
  floorData: Record<string, FloorData>,
  floorRooms: Record<string, Record<string, FloorRoom>>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const floor of selectedFloors) {
    const floorInfo = floorData[floor] || { length: 0, width: 0, area: 0 };
    const floorArea = Number(floorInfo.area || 0);

    // 1. Check if floor dimensions/area are valid
    if (floorArea <= 0) {
      errors.push({
        floor,
        message: `${floor}: Please enter valid floor dimensions (Area is 0 or uncalculated).`,
      });
      continue;
    }

    // 2. Check if floor area exceeds plot area
    if (plotArea > 0 && floorArea > plotArea + 0.01) {
      errors.push({
        floor,
        message: `${floor}: Floor area (${floorArea.toFixed(2)} SQ.FT) cannot exceed plot area (${plotArea.toFixed(2)} SQ.FT).`,
      });
    }

    // 3. Calculate total room area for this floor
    const rooms = floorRooms[floor] || {};
    let roomTotal = 0;

    for (const [roomKey, room] of Object.entries(rooms)) {
      if (!room.selected) continue;

      const count = Number(room.count || 0);
      const areaPerRoom = Number(room.areaPerRoom || 0);
      const roomDefinition = getRoomDefinition(roomKey);

      // 4. Validate manual room area constraints
      if (room.areaMode === "MANUAL" && areaPerRoom < roomDefinition.minArea) {
        errors.push({
          floor,
          roomKey,
          message: `${floor} / ${roomDefinition.label}: Manual area (${areaPerRoom} SQ.FT) is less than the minimum required planner area (${roomDefinition.minArea} SQ.FT).`,
        });
      }

      roomTotal += count * areaPerRoom;
    }

    // 5. Check if room total exceeds floor area
    if (roomTotal > floorArea + 0.01) {
      errors.push({
        floor,
        message: `${floor}: Total room area (${roomTotal.toFixed(2)} SQ.FT) exceeds floor area (${floorArea.toFixed(2)} SQ.FT).`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}