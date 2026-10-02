/* =========================================================
   CONSTRUCTION PLAN SYSTEM — PURE LAYOUT FORMULAS
   ---------------------------------------------------------
   NO state, NO React, NO side effects.
   Only pure, testable, reusable functions.

   ✅ Ye file roomPlanner.ts + architecturalPlanningEngine.ts
      se duplicate calculations nikaal kar ek jagah laati hai.

   Responsibilities:
     - Shared helpers (n, clean, clamp, canonical)
     - Wall thickness
     - Parking detection & width
     - Room standard sizes
     - Toilet orientation
     - Furniture assumptions
     - Rectangle fitting
     - Stair corner flight direction
     - Allocation percentages
     - Aspect ratios
     - Area normalization
     - Width distribution
========================================================= */

import { ParkingMode } from './planningTypes';


// ============================================================
// SECTION 1: SHARED HELPERS
// (Ye 3+ files me duplicate the — ab sirf yahan)
// ============================================================

/**
 * Safe number conversion. Returns fallback if value is not finite.
 */
export function n(v: any, d = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

/**
 * Uppercase + trim string. Null-safe.
 */
export function clean(s: any): string {
  return String(s || '').trim().toUpperCase();
}

/**
 * Clamp a number between min and max.
 */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Canonical room name normalizer.
 * Maps any raw room string to a canonical key used across the engine.
 *
 * ✅ IMPORTANT: LIVING + STAIR combo is checked FIRST (matches roomPlanner).
 */
export function canonical(raw: any): string {
  const s = clean(raw);

  // ✅ Combo check FIRST
  if ((s.includes('LIVING') || s.includes('HALL') || s.includes('DRAWING')) && s.includes('STAIR')) {
    return 'LIVING ROOM + STAIR';
  }

  if (s.includes('KITCHEN') && (s.includes('DINING') || s.includes('CUM'))) return 'KITCHEN CUM DINING';
  if (s.includes('MASTER') && (s.includes('ATTACHED') || s.includes('TOILET') || s.includes('BATH'))) return 'MASTER BEDROOM';
  if (s.includes('MASTER')) return 'MASTER BEDROOM';
  if (s.includes('FRONT') && s.includes('ATTACHED') && (s.includes('BATH') || s.includes('TOILET'))) return 'FRONT ATTACHED BATH';
  if (s.includes('REAR') && s.includes('ATTACHED') && (s.includes('BATH') || s.includes('TOILET'))) return 'REAR ATTACHED BATH';
  if (s.includes('FRONT') && (s.includes('BEDROOM') || s.includes('BED'))) return 'FRONT BEDROOM';
  if (s.includes('REAR') && (s.includes('BEDROOM') || s.includes('BED'))) return 'REAR BEDROOM';
  if (s.includes('BEDROOM') || s === 'BED') return 'BEDROOM';
  if (s.includes('STAIR')) return 'STAIRCASE';
  if (s.includes('LIVING') || s.includes('DRAWING') || s.includes('HALL') || s.includes('LOUNGE')) return 'LIVING ROOM';
  if (s.includes('ATTACHED') && (s.includes('TOILET') || s.includes('BATH'))) return 'ATTACHED TOILET';
  if (s.includes('COMMON') && (s.includes('TOILET') || s.includes('BATH'))) return 'COMMON TOILET';
  if (s.includes('BATH') || s.includes('BATHROOM')) return 'BATHROOM';
  if (s.includes('TOILET') || s === 'WC') return 'COMMON TOILET';
  if (s.includes('KITCHEN')) return 'KITCHEN';
  if (s.includes('DINING')) return 'DINING';
  if (s.includes('POOJA')) return 'POOJA ROOM';
  if (s.includes('STUDY')) return 'STUDY ROOM';
  if (s.includes('PARK') || s.includes('PORCH')) return 'PARKING';
  if (s.includes('DUCT') || s.includes('OTS') || s.includes('SHAFT')) return 'DUCT';
  if (s.includes('PASSAGE') || s.includes('CORRIDOR')) return 'PASSAGE';
  if (s.includes('BALCONY')) return 'BALCONY';
  if (s.includes('UTILITY')) return 'UTILITY';
  if (s.includes('STORE')) return 'STORE';
  if (s.includes('GARDEN') || s.includes('BIKE')) return 'GARDEN / BIKE ENTRY';
  return s || 'ROOM';
}

// ============================================================
// SECTION 1B: PRACTICAL ROOM RULES (moved from roomPlanner.ts)
// ============================================================

export interface PracticalRoomRule {
  minWidth: number;
  minDepth: number;
  preferredWidth: number;
  preferredDepth: number;
  furniture: string;
}

export const PRACTICAL_ROOM_RULES: Record<string, PracticalRoomRule> = {
  // ✅ FIXED: 7.5 (was 10.5) — narrow plots (10x40) me fit ho jaye
  'MASTER BEDROOM': { minWidth: 7.5, minDepth: 9, preferredWidth: 10, preferredDepth: 12, furniture: 'double bed + wardrobe + clear bedside access' },
  // ✅ FIXED: 7 (was 9) — narrow upper floor me fit ho jaye
  'BEDROOM': { minWidth: 7, minDepth: 8.5, preferredWidth: 10, preferredDepth: 11, furniture: 'bed + wardrobe + clear walking path' },
  // ✅ FIXED: 4 (was 4) — compact bedroom
  'FRONT BEDROOM': { minWidth: 4, minDepth: 6, preferredWidth: 7, preferredDepth: 10, furniture: 'bed + wardrobe + clear walking path (compact)' },
  'REAR BEDROOM': { minWidth: 4, minDepth: 6, preferredWidth: 7, preferredDepth: 11, furniture: 'bed + wardrobe + clear walking path (compact)' },
  // ✅ FIXED: 3 (was 3) — compact bath
  'FRONT ATTACHED BATH': { minWidth: 3, minDepth: 3.5, preferredWidth: 4, preferredDepth: 6, furniture: 'WC + basin + compact shower' },
  'REAR ATTACHED BATH': { minWidth: 3, minDepth: 3.5, preferredWidth: 4, preferredDepth: 5.5, furniture: 'WC + basin + compact shower' },
  // ✅ FIXED: 8 (was 10) — narrow plot me fit ho jaye
  'LIVING ROOM': { minWidth: 8, minDepth: 8, preferredWidth: 11, preferredDepth: 13, furniture: 'sofa set + TV wall + circulation' },
  // ✅ FIXED: 7 (was 9) — narrow upper floor me fit ho jaye
  'HALL': { minWidth: 7, minDepth: 8, preferredWidth: 10, preferredDepth: 12, furniture: 'seating + entry circulation' },
  // ✅ FIXED: 4 (was 5) — compact kitchen
  'KITCHEN': { minWidth: 4, minDepth: 5, preferredWidth: 6, preferredDepth: 8, furniture: 'counter run + fridge + working aisle' },
  // ✅ FIXED: 7 (was 9) — narrow plot me fit ho jaye
  'KITCHEN CUM DINING': { minWidth: 7, minDepth: 8, preferredWidth: 10, preferredDepth: 11, furniture: 'kitchen counter + dining table + working aisle' },
  // ✅ FIXED: 6 (was 7) — chhote plots support
  'DINING': { minWidth: 6, minDepth: 7, preferredWidth: 8, preferredDepth: 9, furniture: '4–6 seat dining table + circulation' },
  // ✅ FIXED: 3.5 (was 4) — compact pooja
  'POOJA ROOM': { minWidth: 3.5, minDepth: 4, preferredWidth: 4.5, preferredDepth: 5.5, furniture: 'altar + standing space' },
  // ✅ FIXED: 5 (was 6) — flexible study
  'STUDY ROOM': { minWidth: 5, minDepth: 6, preferredWidth: 7, preferredDepth: 8, furniture: 'desk + chair + storage' },
  // ✅ FIXED: 3.5 (was 4) — compact common toilet
  'COMMON TOILET': { minWidth: 3.5, minDepth: 4, preferredWidth: 5.5, preferredDepth: 4.5, furniture: 'WC + basin + required clear space' },
  // ✅ FIXED: 4 (was 4.5) — narrow me fit ho
  'ATTACHED TOILET': { minWidth: 4, minDepth: 4, preferredWidth: 5, preferredDepth: 6.5, furniture: 'WC + basin + bathing clear space' },
  // ✅ FIXED: 3.5 (was 4) — compact bathroom
  'BATHROOM': { minWidth: 3.5, minDepth: 4, preferredWidth: 5, preferredDepth: 6.5, furniture: 'WC + basin + bathing clear space' },
  // ✅ FIXED: 5 (was 5.5) — 10 ft carpet me fit ho
  'STAIRCASE': { minWidth: 5, minDepth: 8, preferredWidth: 6.0, preferredDepth: 10, furniture: 'two-flight stair + landing/headroom zone' },
  // ✅ FIXED: 4 (was 4) — compact parking
  'PARKING': { minWidth: 4, minDepth: 7, preferredWidth: 8, preferredDepth: 8, furniture: 'car bay + door/vehicle clearance' },
  'DUCT': { minWidth: 1.5, minDepth: 3, preferredWidth: 3, preferredDepth: 4, furniture: 'ventilation/service shaft' },
  'PASSAGE': { minWidth: 3, minDepth: 4, preferredWidth: 3.25, preferredDepth: 6, furniture: 'clear circulation path' },
  'BALCONY': { minWidth: 4, minDepth: 5, preferredWidth: 5, preferredDepth: 8, furniture: 'open circulation / sit-out' },
};
// ============================================================
// SECTION 2: WALL THICKNESS
// ✅ FIXED: Always 4" (0.333 ft) for both external & internal
//    User requirement: pura CAD plan 4" wall ke saath render hoga
// ============================================================

/**
 * Wall thickness in feet.
 * External = 4" = 0.333 ft
 * Internal = 4" = 0.333 ft
 */
export function getWallThicknessFt(_isExternal: boolean): number {
  // ✅ Hamesha 4" — external bhi, internal bhi
  return 4 / 12;
}

export function getExternalWallThicknessFt(): number {
  // ✅ 4" external wall (was 9/12 = 9")
  return 4 / 12;
}

export function getInternalWallThicknessFt(): number {
  // ✅ 4" internal wall
  return 4 / 12;
}

// ============================================================
// SECTION 3: PARKING DETECTION & WIDTH
// ============================================================

export type ParkingType = 'BIKE' | 'CAR' | 'NONE';

/**
 * Detect practical parking type based on plot dimensions + user intent.
 *   - No parking requested → NONE
 *   - Narrow frontage (< 8 ft) → BIKE
 *   - Otherwise → CAR
 */
export function detectParkingType(
  W: number,
  H: number,
  hasParking: boolean,
): ParkingType {
  if (!hasParking) return 'NONE';
  if (W < 8) return 'BIKE';
  if (W < 10 && H < 30) return 'BIKE';
  return 'CAR';
}

/**
 * Parking width as a formula of plot width.
 * 45% of plot width, clamped between 4 ft and 9 ft.
 */
export function getParkingWidth(W: number): number {
  return clamp(W * 0.45, 4, Math.min(9, W - 3));
}

/**
 * Parking depth as a formula of plot length.
 * 20% of plot length, clamped between 8 ft and 10 ft.
 */
export function getParkingDepth(H: number): number {
  return clamp(H * 0.20, 8, 10);
}

// ============================================================
// SECTION 4: STANDARD ROOM SIZES (moved from roomPlanner.ts)
// ============================================================

export type RoomSizeMap = {
  parking: { w: number; h: number };
  kitchen: { w: number; h: number };
  living: { w: number; h: number };
  commonToilet: { w: number; h: number };
  passage: { w: number; h: number };
  masterBedroom: { w: number; h: number };
  attachedToilet: { w: number; h: number };
  stair: { w: number; h: number };
};

/**
 * Formula-based room sizes derived from plot W×H.
 * Used by universal ground floor builder.
 */
export function getStandardRoomSizes(W: number, H: number): RoomSizeMap {
  // STEP 1: Parking + Kitchen (front, road side)
  const parkingW = clamp(W * 0.45, 4, Math.min(9, W - 3));
    // ✅ FIX: Parking depth 8 ft minimum, 12 ft max (10×40 ke case me bhi fit ho)
  const parkingH = clamp(H * 0.20, 8, 12);

  const kitchenW = Math.max(3, W - parkingW);
  const kitchenH = parkingH;

  // STEP 2: Living room (middle)
  const livingH = clamp(H * 0.40, 12, 18);
  const livingW = W;

  // STEP 3: Service (common toilet + passage)
  const serviceH = clamp(H * 0.12, 4, 6);
  const commonToiletW = clamp(W * 0.40, 4, Math.min(6, W - 3));
  const passageW = Math.max(3, W - commonToiletW);

  // STEP 4: Master bedroom (rear)
  const masterBedroomH = clamp(H - parkingH - livingH - serviceH, 9.5, H);
  // ✅ NARROW BEDROOM RULE: width <= 12 ft => attached bath is HORIZONTAL (wide, shallow)
  // and sits on the bedroom ENTRY side, so the bedroom keeps its full width and the
  // entry zone is not wasted. Wider bedrooms keep the vertical strip.
  const narrowBedroom = W <= 12;
  const attachedToiletW = narrowBedroom
    ? clamp(Math.round(W * 0.55 * 4) / 4, 5, Math.max(5, W - 3.5))
    : clamp(W * 0.30, 3.5, 5);
  const attachedToiletH = narrowBedroom
    ? clamp(Math.ceil((30 / attachedToiletW) * 4) / 4, 4.5, 5)
    : masterBedroomH;
  const masterBedroomW = narrowBedroom ? W : Math.max(6, W - attachedToiletW);

  // STEP 5: Staircase
  const stairW = clamp(W * 0.40, 5.5, 7);
  const stairH = clamp(livingH * 0.60, 8, 10);

  return {
    parking: { w: Number(parkingW.toFixed(2)), h: Number(parkingH.toFixed(2)) },
    kitchen: { w: Number(kitchenW.toFixed(2)), h: Number(kitchenH.toFixed(2)) },
    living: { w: Number(livingW.toFixed(2)), h: Number(livingH.toFixed(2)) },
    commonToilet: { w: Number(commonToiletW.toFixed(2)), h: Number(serviceH.toFixed(2)) },
    passage: { w: Number(passageW.toFixed(2)), h: Number(serviceH.toFixed(2)) },
    masterBedroom: { w: Number(masterBedroomW.toFixed(2)), h: Number(masterBedroomH.toFixed(2)) },
    attachedToilet: { w: Number(attachedToiletW.toFixed(2)), h: Number(attachedToiletH.toFixed(2)) },
    stair: { w: Number(stairW.toFixed(2)), h: Number(stairH.toFixed(2)) },
  };
}

// ============================================================
// SECTION 5: TOILET ORIENTATION
// ============================================================

export type ToiletOrientation = 'H' | 'V';

export interface CommonToiletPlacement {
  w: number;
  h: number;
  orientation: ToiletOrientation;
}

/**
 * Common toilet shape based on available width.
 * If width >= 5 → horizontal (wider), else vertical (taller).
 */
export function getCommonToiletOrientation(availableW: number): CommonToiletPlacement {
  const w = clamp(availableW * 0.40, 4, Math.min(6, availableW - 3));
  return {
    w,
    h: w >= 5 ? 4.5 : 6.5,
    orientation: w >= 5 ? 'H' : 'V',
  };
}

export interface AttachedToiletPlacement {
  w: number;
  h: number;
  orientation: ToiletOrientation;
  x: number;
  y: number;
}

/**
 * Attached toilet placement inside master bedroom.
 * Wide master (>= 15 ft) → vertical strip on right.
 * Narrow master → horizontal strip at top.
 */
export function getAttachedToiletOrientation(
  masterW: number,
  masterH: number,
  entrySide: 'TOP' | 'BOTTOM' = 'BOTTOM',
): AttachedToiletPlacement {
  // Wide master (> 12 ft) -> vertical strip on the right.
  if (masterW > 12) {
    const aw = clamp(masterW * 0.30, 4, 5);
    const ah = Math.min(7, masterH * 0.7);
    return {
      w: aw,
      h: ah,
      orientation: 'V',
      x: masterW - aw,
      y: 0,
    };
  }
  // Narrow master (<= 12 ft) -> HORIZONTAL strip on the ENTRY side of the bedroom
  // (side that touches the passage/hall), leaving >= 3.5 ft of entry-door clearance.
  const aw = clamp(Math.round(masterW * 0.55 * 4) / 4, 5, Math.max(5, masterW - 3.5));
  const ah = clamp(Math.ceil((30 / aw) * 4) / 4, 4.5, 5);
  return {
    w: aw,
    h: ah,
    orientation: 'H',
    x: 0,
    y: entrySide === 'BOTTOM' ? Math.max(0, masterH - ah) : 0,
  };
}

// ============================================================
// SECTION 6: FURNITURE ASSUMPTIONS (moved from roomPlanner.ts)
// ============================================================

export interface FurnitureBlock {
  type: string;
  x: number;
  y: number;
  width: number;
  depth: number;
}

/**
 * Formula-based furniture layout assumptions for a given room.
 * Used for feasibility scoring only — not for actual CAD rendering.
 */
export function furnitureAssumptions(
  key: string,
  w: number,
  h: number,
): FurnitureBlock[] {
  const fw = Math.max(0.1, w);
  const fh = Math.max(0.1, h);

  if (
    key === 'MASTER BEDROOM' ||
    key === 'BEDROOM' ||
    key === 'FRONT BEDROOM' ||
    key === 'REAR BEDROOM'
  ) {
    const bedW = Math.min(6.25, Math.max(5, fw - 3.2));
    return [
      {
        type: 'BED',
        x: Math.max(0.6, fw * 0.08),
        y: Math.max(0.6, fh * 0.16),
        width: bedW,
        depth: 6.5,
      },
      {
        type: 'WARDROBE_CLEAR',
        x: Math.max(0.5, fw - 2.1),
        y: 0.6,
        width: 1.8,
        depth: Math.min(7, Math.max(4, fh - 1.2)),
      },
    ];
  }

  if (key === 'LIVING ROOM') {
    return [
      {
        type: 'SOFA_CLEAR',
        x: 0.7,
        y: Math.max(0.7, fh - 4.5),
        width: Math.min(9, Math.max(6, fw - 1.4)),
        depth: 3.4,
      },
      {
        type: 'TV_UNIT',
        x: 0.7,
        y: 0.7,
        width: Math.min(6, Math.max(3, fw - 1.4)),
        depth: 1.5,
      },
      {
        type: 'CENTER_TABLE',
        x: Math.max(0.5, fw / 2 - 2),
        y: Math.max(0.5, fh / 2 - 1.5),
        width: 4,
        depth: 3,
      },
    ];
  }

  if (key === 'DINING') {
    return [
      {
        type: 'DINING_TABLE_CLEAR',
        x: Math.max(0.5, fw / 2 - 3),
        y: Math.max(0.5, fh / 2 - 2),
        width: Math.min(6, Math.max(4, fw - 1)),
        depth: Math.min(4, Math.max(3, fh - 1)),
      },
    ];
  }

  if (key === 'KITCHEN' || key === 'KITCHEN CUM DINING') {
    return [
      {
        type: 'KITCHEN_COUNTER_CLEAR',
        x: 0.35,
        y: 0.35,
        width: Math.min(2, Math.max(1.5, fw - 0.7)),
        depth: Math.min(8, Math.max(4, fh - 0.7)),
      },
      {
        type: 'FRIDGE_CLEAR',
        x: Math.max(0.35, fw - 2.5),
        y: 0.35,
        width: Math.min(2, fw - 0.7),
        depth: Math.min(2.5, fh - 0.7),
      },
    ];
  }

  if (key === 'PASSAGE') {
    return [
      {
        type: 'CIRCULATION_PATH',
        x: 0.2,
        y: 0.2,
        width: Math.max(1, fw - 0.4),
        depth: Math.max(1, fh - 0.4),
      },
    ];
  }

  return [];
}

// ============================================================
// SECTION 7: RECTANGLE FITTING (moved from roomPlanner.ts)
// ============================================================

export interface FittedRect {
  w: number;
  h: number;
}

/**
 * Given a target area, fit a rectangle respecting preferred aspect ratio
 * from PRACTICAL_ROOM_RULES. Never exceeds maxW / maxH.
 */
export function fitRectForArea(
  key: string,
  area: number,
  maxW: number,
  maxH: number,
): FittedRect {
  const rule =
    PRACTICAL_ROOM_RULES[key] ||
    { minWidth: 3, minDepth: 3, preferredWidth: 5, preferredDepth: 6, furniture: '' };

  const preferredW = clamp(
    Math.sqrt(Math.max(1, area) * (rule.preferredWidth / Math.max(1, rule.preferredDepth))),
    rule.minWidth,
    maxW,
  );

  let h = area / Math.max(rule.minWidth, preferredW);
  let w = preferredW;

  if (h > maxH) {
    h = maxH;
    w = area / Math.max(1, h);
  }
  if (w > maxW) {
    w = maxW;
    h = area / Math.max(1, w);
  }

  w = Math.max(Math.min(rule.minWidth, maxW), w);
  h = Math.max(Math.min(rule.minDepth, maxH), h);

  return {
    w: Math.min(maxW, w),
    h: Math.min(maxH, h),
  };
}

// ============================================================
// SECTION 8: STAIR CORNER FLIGHT DIRECTION
// (moved from roomPlanner.ts — pure calculation)
// ============================================================

export type StairCorner = 'BOTTOM-RIGHT' | 'BOTTOM-LEFT' | 'TOP-RIGHT' | 'TOP-LEFT';
export type StairFlightDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type StairFace = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

export interface FlightDirectionResult {
  flightDirection: StairFlightDirection;
  entryFace: StairFace;
  exitFace: StairFace;
  usable: boolean;
  usabilityReason: string;
}

/**
 * Given a stair corner position inside a host room (living room),
 * compute the usable flight direction + entry/exit faces.
 */
export function getFlightDirectionForCorner(
  corner: StairCorner,
  livingW: number,
  livingH: number,
  stairW: number,
  stairH: number,
): FlightDirectionResult {
  const MIN_ENTRY_CLEARANCE = 3.0;

  switch (corner) {
    case 'TOP-RIGHT': {
      const leftSpace = livingW - stairW;
      const bottomSpace = livingH - stairH;
      const entryOk = leftSpace >= MIN_ENTRY_CLEARANCE && bottomSpace >= MIN_ENTRY_CLEARANCE;
      return {
        flightDirection: 'UP',
        entryFace: 'BOTTOM',
        exitFace: 'TOP',
        usable: entryOk,
        usabilityReason: entryOk
          ? `Entry from BOTTOM (${bottomSpace.toFixed(2)}ft clear), exit to TOP`
          : `Entry blocked: left ${leftSpace.toFixed(2)}ft, bottom ${bottomSpace.toFixed(2)}ft`,
      };
    }
    case 'TOP-LEFT': {
      const rightSpace = livingW - stairW;
      const bottomSpace = livingH - stairH;
      const entryOk = rightSpace >= MIN_ENTRY_CLEARANCE && bottomSpace >= MIN_ENTRY_CLEARANCE;
      return {
        flightDirection: 'UP',
        entryFace: 'BOTTOM',
        exitFace: 'TOP',
        usable: entryOk,
        usabilityReason: entryOk
          ? `Entry from BOTTOM (${bottomSpace.toFixed(2)}ft clear), exit to TOP`
          : `Entry blocked: right ${rightSpace.toFixed(2)}ft, bottom ${bottomSpace.toFixed(2)}ft`,
      };
    }
    case 'BOTTOM-RIGHT': {
      const leftSpace = livingW - stairW;
      const topSpace = livingH - stairH;
      const entryOk = leftSpace >= MIN_ENTRY_CLEARANCE && topSpace >= MIN_ENTRY_CLEARANCE;
      return {
        flightDirection: 'DOWN',
        entryFace: 'TOP',
        exitFace: 'BOTTOM',
        usable: entryOk,
        usabilityReason: entryOk
          ? `Entry from TOP (${topSpace.toFixed(2)}ft clear), exit to BOTTOM`
          : `Entry blocked`,
      };
    }
    case 'BOTTOM-LEFT': {
      const rightSpace = livingW - stairW;
      const topSpace = livingH - stairH;
      const entryOk = rightSpace >= MIN_ENTRY_CLEARANCE && topSpace >= MIN_ENTRY_CLEARANCE;
      return {
        flightDirection: 'DOWN',
        entryFace: 'TOP',
        exitFace: 'BOTTOM',
        usable: entryOk,
        usabilityReason: entryOk
          ? `Entry from TOP (${topSpace.toFixed(2)}ft clear), exit to BOTTOM`
          : `Entry blocked`,
      };
    }
  }
}

// ============================================================
// SECTION 9: ALLOCATION PERCENTAGES (NEW)
// ============================================================

export interface RoomAllocation {
  key: string;
  percentage: number;
  minArea: number;
}

/**
 * Suggested room allocation percentages based on floor type, plot size,
 * and parking type. Used by AUTO mode to decide relative proportions.
 *
 * NOTE: These are planning heuristics — NOT statutory minimums.
 */
export function getAllocationPercentages(
  floor: 'GROUND' | 'UPPER' | string,
  W: number,
  H: number,
  parkingType: ParkingType,
): RoomAllocation[] {
  const isGround = String(floor).toUpperCase().includes('GROUND');
  const compact = W <= 22;

  if (isGround) {
    if (compact) {
      return [
        { key: 'PARKING', percentage: 12, minArea: 60 },
        { key: 'KITCHEN', percentage: 10, minArea: 48 },
        { key: 'LIVING ROOM', percentage: 22, minArea: 120 },
        { key: 'COMMON TOILET', percentage: 5, minArea: 24 },
        { key: 'PASSAGE', percentage: 6, minArea: 18 },
        { key: 'MASTER BEDROOM', percentage: 25, minArea: 130 },
        { key: 'ATTACHED TOILET', percentage: 8, minArea: 28 },
        { key: 'STAIRCASE', percentage: 12, minArea: 48 },
      ];
    }
    return [
      { key: 'PARKING', percentage: 10, minArea: 80 },
      { key: 'KITCHEN CUM DINING', percentage: 12, minArea: 100 },
      { key: 'LIVING ROOM', percentage: 20, minArea: 160 },
      { key: 'COMMON TOILET', percentage: 4, minArea: 24 },
      { key: 'PASSAGE', percentage: 5, minArea: 20 },
      { key: 'MASTER BEDROOM', percentage: 22, minArea: 140 },
      { key: 'BEDROOM', percentage: 15, minArea: 100 },
      { key: 'ATTACHED TOILET', percentage: 5, minArea: 28 },
      { key: 'STAIRCASE', percentage: 7, minArea: 48 },
    ];
  }

  // Upper floor
  if (compact) {
    return [
      { key: 'FRONT BEDROOM', percentage: 28, minArea: 90 },
      { key: 'REAR BEDROOM', percentage: 28, minArea: 90 },
      { key: 'FRONT ATTACHED BATH', percentage: 10, minArea: 25 },
      { key: 'REAR ATTACHED BATH', percentage: 10, minArea: 25 },
      { key: 'STAIRCASE', percentage: 14, minArea: 48 },
      { key: 'LIVING ROOM', percentage: 10, minArea: 100 },
    ];
  }
  return [
    { key: 'MASTER BEDROOM', percentage: 22, minArea: 140 },
    { key: 'BEDROOM', percentage: 18, minArea: 110 },
    { key: 'LIVING ROOM', percentage: 18, minArea: 140 },
    { key: 'ATTACHED TOILET', percentage: 6, minArea: 28 },
    { key: 'COMMON TOILET', percentage: 5, minArea: 24 },
    { key: 'STAIRCASE', percentage: 8, minArea: 48 },
    { key: 'BALCONY', percentage: 8, minArea: 30 },
    { key: 'PASSAGE', percentage: 5, minArea: 20 },
  ];
}

// ============================================================
// SECTION 10: ASPECT RATIOS (NEW)
// ============================================================

/**
 * Preferred aspect ratio (long:short) per room type.
 * Used to detect elongated rooms.
 */
export function getRoomAspectRatio(key: string): number {
  const c = canonical(key);
  switch (c) {
    case 'MASTER BEDROOM':
    case 'BEDROOM':
    case 'FRONT BEDROOM':
    case 'REAR BEDROOM':
      return 1.4;
    case 'LIVING ROOM':
      return 1.5;
    case 'KITCHEN':
      return 1.6;
    case 'KITCHEN CUM DINING':
      return 1.3;
    case 'DINING':
      return 1.3;
    case 'BATHROOM':
    case 'COMMON TOILET':
    case 'ATTACHED TOILET':
      return 1.5;
    case 'STAIRCASE':
      return 1.6;
    case 'PARKING':
      return 1.8;
    case 'PASSAGE':
      return 3.0;
    case 'DUCT':
      return 2.5;
    case 'BALCONY':
      return 2.5;
    case 'POOJA ROOM':
      return 1.2;
    case 'STUDY ROOM':
      return 1.3;
    default:
      return 1.5;
  }
}

// ============================================================
// SECTION 11: AREA NORMALIZATION (NEW)
// ============================================================

/**
 * Normalize a set of areas so their sum equals totalArea.
 * Preserves relative proportions.
 */
export function normalizeAreasTo100(
  areas: Record<string, number>,
  totalArea: number,
): Record<string, number> {
  const sum = Object.values(areas).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);
  if (sum <= 0 || totalArea <= 0) {
    const fallback = totalArea / Math.max(1, Object.keys(areas).length);
    const out: Record<string, number> = {};
    for (const k of Object.keys(areas)) out[k] = Number(fallback.toFixed(2));
    return out;
  }
  const scale = totalArea / sum;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(areas)) {
    out[k] = Number((Math.max(0, Number(v) || 0) * scale).toFixed(2));
  }
  return out;
}

// ============================================================
// SECTION 12: WIDTH DISTRIBUTION (NEW)
// ============================================================

export interface WidthItem {
  key: string;
  minWidth: number;
  maxWidth: number;
  preferredRatio: number;
}

/**
 * Distribute total width among items based on preferred ratios,
 * respecting min/max constraints.
 */
export function distributeWidths(
  totalW: number,
  items: WidthItem[],
): Record<string, number> {
  if (!items.length || totalW <= 0) return {};

  const totalMin = items.reduce((s, it) => s + Math.max(0, it.minWidth), 0);
  if (totalMin > totalW) {
    // Not enough space — return minimums scaled down
    const scale = totalW / Math.max(0.01, totalMin);
    const out: Record<string, number> = {};
    for (const it of items) out[it.key] = Number((it.minWidth * scale).toFixed(2));
    return out;
  }

  // Start with preferred ratio allocation
  const totalRatio = items.reduce((s, it) => s + Math.max(0.01, it.preferredRatio), 0);
  const out: Record<string, number> = {};
  let used = 0;

  for (const it of items) {
    const ideal = (it.preferredRatio / totalRatio) * totalW;
    const clamped = clamp(ideal, it.minWidth, it.maxWidth);
    out[it.key] = clamped;
    used += clamped;
  }

  // Distribute leftover
  const leftover = totalW - used;
  if (Math.abs(leftover) > 0.01) {
    const expandable = items.filter(it => out[it.key] < it.maxWidth);
    if (expandable.length > 0) {
      const perRoom = leftover / expandable.length;
      for (const it of expandable) {
        out[it.key] = clamp(out[it.key] + perRoom, it.minWidth, it.maxWidth);
      }
    }
  }

  // Round
  for (const k of Object.keys(out)) {
    out[k] = Number(out[k].toFixed(2));
  }
  return out;
}

// ============================================================
// SECTION 13: FEASIBILITY HELPERS (NEW)
// ============================================================

export interface FeasibilityWarning {
  roomKey: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

/**
 * Quick feasibility check for a single room's dimensions.
 * Returns null if OK.
 */
export function checkRoomFeasibility(
  roomKey: string,
  w: number,
  h: number,
): FeasibilityWarning | null {
  const rule = PRACTICAL_ROOM_RULES[canonical(roomKey)];
  if (!rule) return null;

  const shortDim = Math.min(w, h);
  const longDim = Math.max(w, h);
  const required = Math.min(rule.minWidth, rule.minDepth);

  if (shortDim < required - 0.1) {
    return {
      roomKey,
      severity: 'WARNING',
      message: `${roomKey} is too narrow (${shortDim.toFixed(2)} ft < ${required.toFixed(2)} ft minimum).`,
    };
  }

  const ratio = longDim / Math.max(0.1, shortDim);
  const preferredRatio = getRoomAspectRatio(roomKey) * 1.8;
  if (ratio > preferredRatio) {
    return {
      roomKey,
      severity: 'WARNING',
      message: `${roomKey} is too elongated (${ratio.toFixed(2)}:1).`,
    };
  }

  return null;
}

/**
 * Practical minimum dimension for a room.
 */
export function getRoomMinDimension(roomKey: string): { w: number; h: number } {
  const rule = PRACTICAL_ROOM_RULES[canonical(roomKey)];
  if (!rule) return { w: 3, h: 3 };
  return { w: rule.minWidth, h: rule.minDepth };
}