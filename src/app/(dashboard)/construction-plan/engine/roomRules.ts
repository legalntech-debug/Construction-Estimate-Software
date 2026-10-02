/* =========================================================
CONSTRUCTION PLAN SYSTEM — ROOM RULES & CATALOG
========================================================= */

import { RoomDefinition } from "./planningTypes";

export const ROOM_CATALOG: RoomDefinition[] = [
  // ✅ FIXED: 7 (was 9) — narrow upper floor me fit ho jaye
  { key: "BEDROOM", label: "BEDROOM", minArea: 60, defaultArea: 100, minWidth: 7, minLength: 8.5, defaultWidth: 10, defaultLength: 10, statutoryMinArea: 60 },
  // ✅ FIXED: 7.5 (was 11) — 10×40 plot me fit ho jaye
  { key: "MASTER BEDROOM", label: "MASTER BEDROOM", minArea: 68, defaultArea: 120, minWidth: 7.5, minLength: 9, defaultWidth: 10, defaultLength: 12, statutoryMinArea: 68 },
  // ✅ FIXED: 8 (was 10) — narrow plot me fit ho jaye
  { key: "LIVING ROOM", label: "LIVING ROOM", minArea: 90, defaultArea: 180, minWidth: 8, minLength: 10, defaultWidth: 12, defaultLength: 15, statutoryMinArea: 90 },
  // ✅ FIXED: 7 (was 9) — narrow upper floor me fit ho jaye
  { key: "HALL", label: "HALL", minArea: 56, defaultArea: 150, minWidth: 7, minLength: 8, defaultWidth: 10, defaultLength: 15, statutoryMinArea: 56 },
  { key: "KITCHEN", label: "KITCHEN", minArea: 48, defaultArea: 65, minWidth: 5, minLength: 8, defaultWidth: 6.5, defaultLength: 10, statutoryMinArea: 40, percentageRule: 0.10 },
  // ✅ FIXED: 7 (was 8) — narrow plot me fit ho jaye
  { key: "KITCHEN CUM DINING", label: "KITCHEN CUM DINING", minArea: 56, defaultArea: 130, minWidth: 7, minLength: 8, defaultWidth: 10, defaultLength: 13, statutoryMinArea: 56 },
  // ✅ FIXED: 6 (was 7) — flexible
  { key: "DINING", label: "DINING", minArea: 48, defaultArea: 80, minWidth: 6, minLength: 7, defaultWidth: 8, defaultLength: 10, statutoryMinArea: 48 },
  { key: "STORE", label: "STORE", minArea: 24, defaultArea: 40, minWidth: 4, minLength: 6, defaultWidth: 5, defaultLength: 8, statutoryMinArea: 15 },
  { key: "POOJA ROOM", label: "POOJA ROOM", minArea: 16, defaultArea: 30, minWidth: 4, minLength: 4, defaultWidth: 5, defaultLength: 6, statutoryMinArea: 15 },
  { key: "BATHROOM", label: "BATHROOM", minArea: 24, defaultArea: 45, minWidth: 4, minLength: 6, defaultWidth: 5, defaultLength: 9, statutoryMinArea: 25 },
  // ✅ FIXED: 4 (was 4.5) — narrow me fit ho
  { key: "ATTACHED TOILET", label: "ATTACHED TOILET", minArea: 20, defaultArea: 50, minWidth: 4, minLength: 5, defaultWidth: 5, defaultLength: 10, statutoryMinArea: 20 },
  // ✅ FIXED: 3.5 (was 4) — compact
  { key: "COMMON TOILET", label: "COMMON TOILET", minArea: 18, defaultArea: 45, minWidth: 3.5, minLength: 4.5, defaultWidth: 5, defaultLength: 9, statutoryMinArea: 18 },
  { key: "WC", label: "WC", minArea: 15, defaultArea: 24, minWidth: 3.5, minLength: 4.5, defaultWidth: 4, defaultLength: 6, statutoryMinArea: 15 },
  { key: "DRESSING", label: "DRESSING", minArea: 20, defaultArea: 35, minWidth: 4, minLength: 5, defaultWidth: 5, defaultLength: 7, statutoryMinArea: 20 },
  { key: "STUDY ROOM", label: "STUDY ROOM", minArea: 48, defaultArea: 70, minWidth: 5, minLength: 7, defaultWidth: 7, defaultLength: 10, statutoryMinArea: 40 },
  { key: "UTILITY", label: "UTILITY", minArea: 20, defaultArea: 35, minWidth: 4, minLength: 5, defaultWidth: 5, defaultLength: 7, statutoryMinArea: 20 },
  { key: "BALCONY", label: "BALCONY", minArea: 21, defaultArea: 45, minWidth: 3.5, minLength: 6, defaultWidth: 4.5, defaultLength: 10, statutoryMinArea: 20 },
  { key: "PARKING", label: "PARKING", minArea: 80, defaultArea: 120, minWidth: 8, minLength: 10, defaultWidth: 10, defaultLength: 12, statutoryMinArea: 100 },
  { key: "GARDEN / BIKE ENTRY", label: "GARDEN / BIKE ENTRY", minArea: 30, defaultArea: 50, minWidth: 3.5, minLength: 8, defaultWidth: 5, defaultLength: 10, statutoryMinArea: 30 },
  { key: "MULTI USE FRONT", label: "MULTI USE FRONT", minArea: 30, defaultArea: 50, minWidth: 3.5, minLength: 8, defaultWidth: 5, defaultLength: 10, statutoryMinArea: 30 },
  // ✅ FIXED: 5 (was 6) — 10 ft carpet me fit ho
  { key: "STAIRCASE", label: "STAIRCASE", minArea: 40, defaultArea: 65, minWidth: 5, minLength: 8, defaultWidth: 6.5, defaultLength: 10, statutoryMinArea: 40 },
  { key: "DUCT", label: "DUCT", minArea: 9, defaultArea: 24, minWidth: 3, minLength: 3, defaultWidth: 4, defaultLength: 6, statutoryMinArea: 9 },
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

// ============================================================
// ✅ FIX: Safe fallback room definition
// Used when key is undefined/null/invalid — prevents crash
// ============================================================
const FALLBACK_ROOM_DEFINITION: RoomDefinition = {
  key: "ROOM",
  label: "ROOM",
  minArea: 9,
  defaultArea: 100,
  minWidth: 3,
  minLength: 3,
  defaultWidth: 10,
  defaultLength: 10,
  statutoryMinArea: 9,
} as RoomDefinition;

/**
 * ✅ FIXED: Safe room definition lookup
 * - Handles undefined/null/non-string keys
 * - Handles empty strings
 * - Returns fallback instead of crashing
 */
export function getRoomDefinition(roomKey: string | undefined | null): RoomDefinition {
  // ✅ Guard: null/undefined
  if (roomKey === undefined || roomKey === null) {
    if (typeof console !== 'undefined') {
      console.warn('[ROOM RULES] getRoomDefinition called with null/undefined key, using fallback.');
    }
    return FALLBACK_ROOM_DEFINITION;
  }

  // ✅ Guard: non-string types
  if (typeof roomKey !== 'string') {
    if (typeof console !== 'undefined') {
      console.warn('[ROOM RULES] getRoomDefinition called with non-string key:', roomKey, ', using fallback.');
    }
    return FALLBACK_ROOM_DEFINITION;
  }

  // ✅ Guard: empty after trim
  const normalizedKey = roomKey.trim().toUpperCase();
  if (!normalizedKey) {
    if (typeof console !== 'undefined') {
      console.warn('[ROOM RULES] getRoomDefinition called with empty key, using fallback.');
    }
    return FALLBACK_ROOM_DEFINITION;
  }

  // ✅ Lookup in catalog
  const found = ROOM_CATALOG.find(
    (room) => room.key === normalizedKey || room.label === normalizedKey
  );

  if (!found) {
    if (typeof console !== 'undefined') {
      console.warn(`[ROOM RULES] No definition found for key "${normalizedKey}", using fallback.`);
    }
    return FALLBACK_ROOM_DEFINITION;
  }

  return found;
}

export function calculateRoomAutoArea(
  room: RoomDefinition | undefined | null,
  floorArea: number,
  isGroundFloor: boolean
): number {
  // ✅ FIX: Guard against undefined room
  if (!room || typeof room !== 'object') {
    return Math.max(1, floorArea * 0.1);
  }

  const safeFloorArea = Number.isFinite(floorArea) && floorArea > 0 ? floorArea : 100;

  // Kitchen area floor area ke 10% par calculate hota hai
  if (room.key === "KITCHEN") {
    const calculated = safeFloorArea * (room.percentageRule || 0.10);
    return Math.max(Math.round(calculated), room.minArea || 48);
  }

  // Living Room Ground Floor par hamesha minimum 180 rakhna better hai
  let area = room.defaultArea || 100;

  if (room.key === "LIVING ROOM" && isGroundFloor) {
    area = Math.max(area, 180);
  }

  return area;
}

/**
 * ✅ FIXED: Validate & fix room dimensions
 * - Handles invalid inputs
 * - Enforces statutory minimums
 * - Never returns NaN
 */
export function validateAndFixRoomDimensions(
  roomKey: string | undefined | null,
  w: number,
  h: number
): { w: number; h: number } {
  const def = getRoomDefinition(roomKey);

  // ✅ Guard: invalid numbers
  const safeW = Number.isFinite(w) && w > 0 ? w : def.minWidth;
  const safeH = Number.isFinite(h) && h > 0 ? h : def.minLength;
  const area = safeW * safeH;

  const minW = def.minWidth || 3;
  const minL = def.minLength || 3;

  let fixedW = Math.max(safeW, minW);
  let fixedH = Math.max(safeH, minL);

  // ✅ Enforce statutory minimum area
  if (def.statutoryMinArea && area < def.statutoryMinArea) {
    const targetH = def.statutoryMinArea / Math.max(0.1, fixedW);
    fixedH = Math.max(fixedH, targetH);
  }

  // ✅ Cap at reasonable max (2x default) to prevent runaway
  const maxW = (def.defaultWidth || 12) * 2;
  const maxH = (def.defaultLength || 15) * 2;
  fixedW = Math.min(fixedW, maxW);
  fixedH = Math.min(fixedH, maxH);

  return { w: fixedW, h: fixedH };
}

/**
 * ✅ NEW: Safe area lookup for a room key
 * Returns a positive area even if key is invalid.
 */
export function getRoomArea(roomKey: string | undefined | null): number {
  const def = getRoomDefinition(roomKey);
  return Math.max(1, def.defaultArea || 100);
}

/**
 * ✅ NEW: Safe minimum width for a room key
 */
export function getRoomMinWidth(roomKey: string | undefined | null): number {
  const def = getRoomDefinition(roomKey);
  return Math.max(1, def.minWidth || 3);
}

/**
 * ✅ NEW: Safe minimum length for a room key
 */
export function getRoomMinLength(roomKey: string | undefined | null): number {
  const def = getRoomDefinition(roomKey);
  return Math.max(1, def.minLength || 3);
}