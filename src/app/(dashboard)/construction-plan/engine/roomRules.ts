/* =========================================================
CONSTRUCTION PLAN SYSTEM — ROOM RULES & CATALOG
========================================================= */

import { RoomDefinition } from "./planningTypes";

export const ROOM_CATALOG: RoomDefinition[] = [
  { key: "BEDROOM", label: "BEDROOM", minArea: 90, defaultArea: 140, minWidth: 9, minLength: 10, defaultWidth: 10, defaultLength: 14, statutoryMinArea: 96 },
  { key: "MASTER BEDROOM", label: "MASTER BEDROOM", minArea: 130, defaultArea: 180, minWidth: 11, minLength: 12, defaultWidth: 12, defaultLength: 15, statutoryMinArea: 110 },
  { key: "LIVING ROOM", label: "LIVING ROOM", minArea: 120, defaultArea: 180, minWidth: 10, minLength: 12, defaultWidth: 12, defaultLength: 15, statutoryMinArea: 120 },
  { key: "HALL", label: "HALL", minArea: 100, defaultArea: 150, minWidth: 9, minLength: 12, defaultWidth: 10, defaultLength: 15, statutoryMinArea: 90 },
  { key: "KITCHEN", label: "KITCHEN", minArea: 48, defaultArea: 65, minWidth: 6, minLength: 8, defaultWidth: 6.5, defaultLength: 10, statutoryMinArea: 53.82, percentageRule: 0.10 },
  { key: "KITCHEN CUM DINING", label: "KITCHEN CUM DINING", minArea: 80, defaultArea: 130, minWidth: 8, minLength: 10, defaultWidth: 10, defaultLength: 13, statutoryMinArea: 80 },
  { key: "DINING", label: "DINING", minArea: 60, defaultArea: 80, minWidth: 7, minLength: 8, defaultWidth: 8, defaultLength: 10, statutoryMinArea: 60 },
  { key: "STORE", label: "STORE", minArea: 24, defaultArea: 40, minWidth: 4, minLength: 6, defaultWidth: 5, defaultLength: 8, statutoryMinArea: 15 },
  { key: "POOJA ROOM", label: "POOJA ROOM", minArea: 16, defaultArea: 30, minWidth: 4, minLength: 4, defaultWidth: 5, defaultLength: 6, statutoryMinArea: 15 },
  { key: "BATHROOM", label: "BATHROOM", minArea: 24, defaultArea: 45, minWidth: 4, minLength: 6, defaultWidth: 5, defaultLength: 9, statutoryMinArea: 25 },
  { key: "ATTACHED TOILET", label: "ATTACHED TOILET", minArea: 28, defaultArea: 50, minWidth: 4.5, minLength: 6.5, defaultWidth: 5, defaultLength: 10, statutoryMinArea: 25 },
  { key: "COMMON TOILET", label: "COMMON TOILET", minArea: 24, defaultArea: 45, minWidth: 4, minLength: 6, defaultWidth: 5, defaultLength: 9, statutoryMinArea: 25 },
  { key: "WC", label: "WC", minArea: 15, defaultArea: 24, minWidth: 3.5, minLength: 4.5, defaultWidth: 4, defaultLength: 6, statutoryMinArea: 15 },
  { key: "DRESSING", label: "DRESSING", minArea: 20, defaultArea: 35, minWidth: 4, minLength: 5, defaultWidth: 5, defaultLength: 7, statutoryMinArea: 20 },
  { key: "STUDY ROOM", label: "STUDY ROOM", minArea: 48, defaultArea: 70, minWidth: 6, minLength: 8, defaultWidth: 7, defaultLength: 10, statutoryMinArea: 40 },
  { key: "UTILITY", label: "UTILITY", minArea: 20, defaultArea: 35, minWidth: 4, minLength: 5, defaultWidth: 5, defaultLength: 7, statutoryMinArea: 20 },
  { key: "BALCONY", label: "BALCONY", minArea: 21, defaultArea: 45, minWidth: 3.5, minLength: 6, defaultWidth: 4.5, defaultLength: 10, statutoryMinArea: 20 },
  { key: "PARKING", label: "PARKING", minArea: 80, defaultArea: 120, minWidth: 8, minLength: 10, defaultWidth: 10, defaultLength: 12, statutoryMinArea: 100 },
  { key: "GARDEN / BIKE ENTRY", label: "GARDEN / BIKE ENTRY", minArea: 30, defaultArea: 50, minWidth: 3.5, minLength: 8, defaultWidth: 5, defaultLength: 10, statutoryMinArea: 30 },
  { key: "MULTI USE FRONT", label: "MULTI USE FRONT", minArea: 30, defaultArea: 50, minWidth: 3.5, minLength: 8, defaultWidth: 5, defaultLength: 10, statutoryMinArea: 30 },
  { key: "STAIRCASE", label: "STAIRCASE", minArea: 48, defaultArea: 65, minWidth: 6, minLength: 8, defaultWidth: 6.5, defaultLength: 10, statutoryMinArea: 40 },
  { key: "DUCT", label: "DUCT", minArea: 9, defaultArea: 24, minWidth: 3, minLength: 3, defaultWidth: 4, defaultLength: 6, statutoryMinArea: 15 },
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
  // Kitchen area floor area ke 10% par calculate hota hai
  if (room.key === "KITCHEN") {
    const calculated = floorArea * (room.percentageRule || 0.10);
    return Math.max(Math.round(calculated), room.minArea);
  }

  // Living Room Ground Floor par hamesha minimum 180 rakhna better hai
  let area = room.defaultArea;

  if (room.key === "LIVING ROOM" && isGroundFloor) {
    area = Math.max(area, 180);
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
  const minL = def.minLength;
  const area = w * h;

  let fixedW = Math.max(w, minW);
  let fixedH = Math.max(h, minL);

  if (def.statutoryMinArea && area < def.statutoryMinArea) {
    fixedH = Math.max(fixedH, def.statutoryMinArea / fixedW);
  }

  return { w: fixedW, h: fixedH };
}