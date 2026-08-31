/* =========================================================
CONSTRUCTION PLAN SYSTEM — ROOM RULES & CATALOG
========================================================= */

import { RoomDefinition } from "./planningTypes";

export const ROOM_CATALOG: RoomDefinition[] = [
  { key: "BEDROOM", label: "BEDROOM", minArea: 102, defaultArea: 120, minWidth: 8, statutoryMinArea: 96 },
  { key: "MASTER BEDROOM", label: "MASTER BEDROOM", minArea: 120, defaultArea: 140, minWidth: 10, statutoryMinArea: 110 },
  { key: "LIVING ROOM", label: "LIVING ROOM", minArea: 120, defaultArea: 160, minWidth: 10, statutoryMinArea: 120 },
  { key: "HALL", label: "HALL", minArea: 100, defaultArea: 130, minWidth: 9, statutoryMinArea: 90 },
  { key: "KITCHEN", label: "KITCHEN", minArea: 50, defaultArea: 70, minWidth: 6, statutoryMinArea: 53.82, percentageRule: 0.10 },
  { key: "DINING", label: "DINING", minArea: 60, defaultArea: 80, minWidth: 7, statutoryMinArea: 60 },
  { key: "STORE", label: "STORE", minArea: 20, defaultArea: 30, minWidth: 4, statutoryMinArea: 15 },
  { key: "POOJA ROOM", label: "POOJA ROOM", minArea: 20, defaultArea: 25, minWidth: 4, statutoryMinArea: 15 },
  { key: "BATHROOM", label: "BATHROOM", minArea: 35, defaultArea: 45, minWidth: 4, statutoryMinArea: 25 },
  { key: "ATTACHED TOILET", label: "ATTACHED TOILET", minArea: 35, defaultArea: 45, minWidth: 4, statutoryMinArea: 25 },
  { key: "COMMON TOILET", label: "COMMON TOILET", minArea: 35, defaultArea: 45, minWidth: 4, statutoryMinArea: 25 },
  { key: "WC", label: "WC", minArea: 18, defaultArea: 22, minWidth: 3, statutoryMinArea: 15 },
  { key: "DRESSING", label: "DRESSING", minArea: 25, defaultArea: 35, minWidth: 4, statutoryMinArea: 20 },
  { key: "STUDY ROOM", label: "STUDY ROOM", minArea: 45, defaultArea: 60, minWidth: 6, statutoryMinArea: 40 },
  { key: "UTILITY", label: "UTILITY", minArea: 25, defaultArea: 35, minWidth: 4, statutoryMinArea: 20 },
  { key: "BALCONY", label: "BALCONY", minArea: 25, defaultArea: 40, minWidth: 4, statutoryMinArea: 20 },
  { key: "PARKING", label: "PARKING", minArea: 100, defaultArea: 120, minWidth: 8, statutoryMinArea: 100 },
  { key: "GARDEN / BIKE ENTRY", label: "GARDEN / BIKE ENTRY", minArea: 35, defaultArea: 50, minWidth: 3.5, statutoryMinArea: 30 },
  { key: "MULTI USE FRONT", label: "MULTI USE FRONT", minArea: 35, defaultArea: 50, minWidth: 3.5, statutoryMinArea: 30 },
  { key: "STAIRCASE", label: "STAIRCASE", minArea: 45, defaultArea: 65, minWidth: 6, statutoryMinArea: 40 },
];

export const DEFAULT_ROOM_SELECTION = [
  "BEDROOM",
  "LIVING ROOM",
  "KITCHEN",
  "BATHROOM",
];

export const BHK_PRESETS = {
  "1 RK": [
    ["LIVING ROOM", 1],
    ["KITCHEN", 1],
    ["BATHROOM", 1],
  ],
  "1 BHK": [
    ["BEDROOM", 1],
    ["LIVING ROOM", 1],
    ["KITCHEN", 1],
    ["BATHROOM", 1],
  ],
  "2 BHK": [
    ["MASTER BEDROOM", 1],
    ["BEDROOM", 1],
    ["LIVING ROOM", 1],
    ["KITCHEN", 1],
    ["BATHROOM", 2],
  ],
  "3 BHK": [
    ["MASTER BEDROOM", 1],
    ["BEDROOM", 2],
    ["LIVING ROOM", 1],
    ["KITCHEN", 1],
    ["BATHROOM", 3],
  ],
  "4 BHK": [
    ["MASTER BEDROOM", 1],
    ["BEDROOM", 3],
    ["LIVING ROOM", 1],
    ["KITCHEN", 1],
    ["DINING", 1],
    ["BATHROOM", 4],
    ["POOJA ROOM", 1],
  ],
} as const;

export function getRoomDefinition(roomKey: string): RoomDefinition {
  const normalizedKey = roomKey.trim().toUpperCase();
  return (
    ROOM_CATALOG.find((room) => room.key === normalizedKey || room.label === normalizedKey) ||
    ROOM_CATALOG[0]
  );
}

export function calculateRoomAutoArea(
  room: RoomDefinition,
  floorArea: number,
  isGroundFloor: boolean
): number {
  if (room.key === "KITCHEN") {
    const calculated = floorArea * (room.percentageRule || 0.10);
    return Math.max(Math.round(calculated), room.minArea);
  }

  let area = room.defaultArea;

  if (room.key === "LIVING ROOM" && isGroundFloor) {
    area = Math.max(area, 160);
  }

  return area;
}

export function validateAndFixRoomDimensions(
  roomKey: string,
  w: number,
  h: number
): { w: number; h: number } {
  const def = getRoomDefinition(roomKey);
  const minW = def.minWidth;
  const area = w * h;

  let fixedW = Math.max(w, minW);
  let fixedH = h;

  if (def.statutoryMinArea && area < def.statutoryMinArea) {
    fixedH = Math.max(h, def.statutoryMinArea / fixedW);
  }

  return { w: fixedW, h: fixedH };
}