// ============================================================
// CONSTRUCTION PLAN ENGINE
// Version 1 - Foundation
// ============================================================

export type PlotShape =
  | "RECTANGLE"
  | "RECTANGULAR"
  | "SQUARE"
  | "IRREGULAR"
  | "L-SHAPE"
  | "IRREGULAR / L-SHAPE"
  | "TRAPEZOIDAL"
  | "POLYGON";

export type AreaMode = "AUTO" | "MANUAL";

export type RoomType =
  | "LIVING ROOM"
  | "BEDROOM"
  | "MASTER BEDROOM"
  | "KITCHEN"
  | "DINING"
  | "HALL"
  | "POOJA ROOM"
  | "STORE"
  | "BATHROOM"
  | "TOILET"
  | "DRESSING"
  | "UTILITY"
  | "PASSAGE"
  | "STAIRCASE"
  | "PARKING"
  | "BALCONY"
  | "VERANDA"
  | "OTHER";

export interface PlotDimensions {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
  f?: number;

  A?: number;
  B?: number;
  C?: number;
  D?: number;
  E?: number;
  F?: number;

  north?: number;
  south?: number;
  east?: number;
  west?: number;
  
  [key: string]: number | undefined;
}

export interface RoomItem {
  id: string;
  type: RoomType;
  name: string;

  count: number;

  areaMode: AreaMode;

  areaPerUnit: number;

  totalArea: number;

  autoArea?: number;

  manualArea?: number;

  vastuZone?: string;

  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface FloorPlanData {
  floor: string;

  length: number;
  width: number;

  area: number;

  rooms: RoomItem[];

  totalRoomArea: number;

  remainingArea: number;

  valid: boolean;
}

export interface ConstructionPlanData {
  plotShape: PlotShape;

  plotArea: number;

  dimensions: PlotDimensions;

  floors: FloorPlanData[];

  roadSides: string[];

  frontSide: string;

  boundaries: {
    north: string;
    south: string;
    east: string;
    west: string;
  };
}

// ============================================================
// BASIC HELPERS
// ============================================================

export function round2(value: number): number {
  return Number(Number(value || 0).toFixed(2));
}

export function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ============================================================
// PLOT AREA
// ============================================================

export function calculateRectangularPlotArea(
  width: number,
  length: number
): number {
  return round2(safeNumber(width) * safeNumber(length));
}

export function calculateIrregularPlotArea(
  a: number,
  b: number,
  c: number,
  d: number
): number {
  /*
   * IMPORTANT:
   *
   * Four side lengths alone do NOT uniquely determine
   * the area of an arbitrary irregular quadrilateral.
   *
   * Therefore we intentionally DO NOT pretend that
   * A × average(B/C) is a legally accurate area.
   *
   * For irregular plots, the future version should accept:
   *
   * 1. diagonals / angles, OR
   * 2. coordinates, OR
   * 3. surveyed area.
   *
   * Until then this function returns 0 so that the UI
   * can force proper geometry input.
   */

  if (
    safeNumber(a) <= 0 ||
    safeNumber(b) <= 0 ||
    safeNumber(c) <= 0 ||
    safeNumber(d) <= 0
  ) {
    return 0;
  }

  return 0;
}

// ============================================================
// FLOOR AREA
// ============================================================

export function calculateFloorArea(
  length: number,
  width: number
): number {
  return round2(
    safeNumber(length) *
      safeNumber(width)
  );
}

// ============================================================
// FLOOR VALIDATION
// ============================================================

export interface FloorValidationResult {
  valid: boolean;

  floorArea: number;

  plotArea: number;

  excessArea: number;

  message: string;
}

export function validateFloorArea(
  floorName: string,
  floorArea: number,
  plotArea: number
): FloorValidationResult {
  const area = round2(floorArea);
  const plot = round2(plotArea);

  if (area <= 0) {
    return {
      valid: false,
      floorArea: area,
      plotArea: plot,
      excessArea: 0,
      message: `${floorName}: Floor area must be greater than zero.`,
    };
  }

  if (plot <= 0) {
    return {
      valid: false,
      floorArea: area,
      plotArea: plot,
      excessArea: 0,
      message: "Plot area is not available.",
    };
  }

  if (area > plot) {
    const excess = round2(area - plot);

    return {
      valid: false,
      floorArea: area,
      plotArea: plot,
      excessArea: excess,
      message:
        `${floorName}: Floor area ${area} SQ.FT ` +
        `cannot exceed plot area ${plot} SQ.FT.`,
    };
  }

  return {
    valid: true,
    floorArea: area,
    plotArea: plot,
    excessArea: 0,
    message: `${floorName}: Floor area is valid.`,
  };
}

// ============================================================
// ROOM AREA NORMS
// ============================================================

/*
 * These are DESIGN DEFAULTS, NOT statutory approval rules.
 *
 * Final statutory minimums must come from the applicable
 * local development/building ruleset.
 */

export const ROOM_AREA_DEFAULTS: Record<
  RoomType,
  {
    minArea: number;
    preferredArea: number;
    minWidth: number;
  }
> = {
  "LIVING ROOM": {
    minArea: 100,
    preferredArea: 140,
    minWidth: 10,
  },

  "BEDROOM": {
    minArea: 100,
    preferredArea: 120,
    minWidth: 10,
  },

  "MASTER BEDROOM": {
    minArea: 120,
    preferredArea: 150,
    minWidth: 11,
  },

  "KITCHEN": {
    minArea: 50,
    preferredArea: 70,
    minWidth: 7,
  },

  "DINING": {
    minArea: 60,
    preferredArea: 90,
    minWidth: 8,
  },

  "HALL": {
    minArea: 100,
    preferredArea: 140,
    minWidth: 10,
  },

  "POOJA ROOM": {
    minArea: 20,
    preferredArea: 30,
    minWidth: 4,
  },

  "STORE": {
    minArea: 20,
    preferredArea: 30,
    minWidth: 4,
  },

  "BATHROOM": {
    minArea: 30,
    preferredArea: 40,
    minWidth: 4,
  },

  "TOILET": {
    minArea: 20,
    preferredArea: 30,
    minWidth: 4,
  },

  "DRESSING": {
    minArea: 30,
    preferredArea: 40,
    minWidth: 5,
  },

  "UTILITY": {
    minArea: 25,
    preferredArea: 40,
    minWidth: 5,
  },

  "PASSAGE": {
    minArea: 20,
    preferredArea: 40,
    minWidth: 4,
  },

  "STAIRCASE": {
    minArea: 60,
    preferredArea: 80,
    minWidth: 6,
  },

  "PARKING": {
    minArea: 120,
    preferredArea: 150,
    minWidth: 9,
  },

  "BALCONY": {
    minArea: 20,
    preferredArea: 40,
    minWidth: 4,
  },

  "VERANDA": {
    minArea: 30,
    preferredArea: 60,
    minWidth: 5,
  },

  "OTHER": {
    minArea: 20,
    preferredArea: 40,
    minWidth: 4,
  },
};

// ============================================================
// AUTO ROOM AREA
// ============================================================

export function getAutoRoomArea(
  roomType: RoomType,
  availableArea: number
): number {
  const rule = ROOM_AREA_DEFAULTS[roomType];

  if (!rule) {
    return 0;
  }

  if (availableArea <= 0) {
    return 0;
  }

  return round2(
    Math.min(
      rule.preferredArea,
      availableArea
    )
  );
}

// ============================================================
// ROOM TOTAL
// ============================================================

export function calculateRoomTotal(
  rooms: RoomItem[]
): number {
  return round2(
    rooms.reduce(
      (sum, room) =>
        sum +
        safeNumber(room.totalArea),
      0
    )
  );
}

// ============================================================
// FLOOR ROOM VALIDATION
// ============================================================

export interface RoomValidationResult {
  valid: boolean;

  totalRoomArea: number;

  floorArea: number;

  remainingArea: number;

  message: string;
}

export function validateFloorRooms(
  floorName: string,
  floorArea: number,
  rooms: RoomItem[]
): RoomValidationResult {
  const totalRoomArea =
    calculateRoomTotal(rooms);

  const remainingArea =
    round2(floorArea - totalRoomArea);

  if (totalRoomArea > floorArea) {
    return {
      valid: false,
      totalRoomArea,
      floorArea,
      remainingArea,
      message:
        `${floorName}: Selected rooms occupy ` +
        `${totalRoomArea} SQ.FT, which exceeds ` +
        `floor area ${floorArea} SQ.FT.`,
    };
  }

  return {
    valid: true,
    totalRoomArea,
    floorArea,
    remainingArea,
    message:
      `${floorName}: Room allocation is valid.`,
  };
}

// ============================================================
// ALL FLOOR VALIDATION
// ============================================================

export interface ConstructionValidationResult {
  valid: boolean;

  errors: string[];

  warnings: string[];

  floorResults: Record<
    string,
    RoomValidationResult
  >;
}

export function validateConstructionPlan(
  plotArea: number,
  floors: FloorPlanData[]
): ConstructionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const floorResults: Record<
    string,
    RoomValidationResult
  > = {};

  if (plotArea <= 0) {
    errors.push(
      "Plot area must be greater than zero."
    );
  }

  for (const floor of floors) {
    const floorValidation =
      validateFloorArea(
        floor.floor,
        floor.area,
        plotArea
      );

    if (!floorValidation.valid) {
      errors.push(
        floorValidation.message
      );
    }

    const roomValidation =
      validateFloorRooms(
        floor.floor,
        floor.area,
        floor.rooms
      );

    floorResults[floor.floor] =
      roomValidation;

    if (!roomValidation.valid) {
      errors.push(
        roomValidation.message
      );
    }

    /*
     * Remaining area is not automatically converted
     * into rooms.
     *
     * It will later be consumed by:
     *
     * - walls
     * - passage
     * - lobby
     * - shafts
     * - staircase
     * - utility
     * - open spaces
     */
    if (
      roomValidation.remainingArea > 0 &&
      roomValidation.remainingArea < 30
    ) {
      warnings.push(
        `${floor.floor}: Only ` +
        `${roomValidation.remainingArea} SQ.FT ` +
        `remaining for circulation/walls/services.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    floorResults,
  };
}

// ============================================================
// VASTU ENGINE
// ============================================================

export const VASTU_ZONES = {
  NE: "NORTH-EAST",
  E: "EAST",
  SE: "SOUTH-EAST",
  S: "SOUTH",
  SW: "SOUTH-WEST",
  W: "WEST",
  NW: "NORTH-WEST",
  N: "NORTH",
  CENTER: "CENTER",
} as const;

export const VASTU_PREFERENCES: Record<
  RoomType,
  string[]
> = {
  "LIVING ROOM": [
    "NORTH",
    "EAST",
    "NORTH-EAST",
  ],

  "MASTER BEDROOM": [
    "SOUTH-WEST",
  ],

  "BEDROOM": [
    "SOUTH-WEST",
    "WEST",
    "NORTH-WEST",
  ],

  "KITCHEN": [
    "SOUTH-EAST",
    "NORTH-WEST",
  ],

  "POOJA ROOM": [
    "NORTH-EAST",
    "EAST",
  ],

  "BATHROOM": [
    "WEST",
    "NORTH-WEST",
    "SOUTH",
  ],

  "TOILET": [
    "WEST",
    "NORTH-WEST",
    "SOUTH",
  ],

  "STAIRCASE": [
    "SOUTH",
    "WEST",
    "SOUTH-WEST",
    "NORTH-WEST",
  ],

  "STORE": [
    "SOUTH",
    "WEST",
  ],

  "DINING": [
    "EAST",
    "WEST",
  ],

  "HALL": [
    "NORTH",
    "EAST",
  ],

  "DRESSING": [
    "WEST",
    "SOUTH",
  ],

  "UTILITY": [
    "SOUTH-EAST",
    "NORTH-WEST",
  ],

  "PASSAGE": [
    "NORTH",
    "EAST",
    "CENTER",
  ],

  "PARKING": [
    "NORTH",
    "NORTH-WEST",
    "EAST",
  ],

  "BALCONY": [
    "NORTH",
    "EAST",
  ],

  "VERANDA": [
    "NORTH",
    "EAST",
  ],

  "OTHER": [],
};

// ============================================================
// VASTU SCORE
// ============================================================

export function getVastuScore(
  roomType: RoomType,
  zone: string
): number {
  const preferred =
    VASTU_PREFERENCES[roomType] || [];

  if (preferred.length === 0) {
    return 50;
  }

  if (
    preferred.includes(zone)
  ) {
    return 100;
  }

  /*
   * This is intentionally a soft score.
   *
   * Vastu is a planning preference layer,
   * not a building approval rule.
   */

  return 40;
}

// ============================================================
// STAIRCASE ENGINE
// ============================================================

export interface StaircaseResult {
  floorHeight: number;

  riserHeight: number;

  riserCount: number;

  treadDepth: number;

  flightCount: number;

  staircaseWidth: number;

  totalRun: number;

  valid: boolean;

  message: string;
}

export function calculateStaircase(
  floorHeightFt = 10,
  availableRunFt = 15,
  staircaseWidthFt = 3.0
): StaircaseResult {
  const floorHeightIn =
    floorHeightFt * 12;

  /*
   * Residential design target.
   *
   * Final statutory value must be checked
   * against selected jurisdiction/ruleset.
   */

  const targetRiserIn = 7;

  let riserCount =
    Math.round(
      floorHeightIn /
      targetRiserIn
    );

  if (riserCount < 1) {
    riserCount = 1;
  }

  const actualRiserIn =
    floorHeightIn /
    riserCount;

  const treadDepthIn = 10;

  const flightCount =
    riserCount > 12 ? 2 : 1;

  const totalRunIn =
    (riserCount - 1) *
    treadDepthIn;

  const totalRunFt =
    totalRunIn / 12;

  const valid =
    actualRiserIn > 0 &&
    totalRunFt <= availableRunFt;

  return {
    floorHeight: floorHeightFt,

    riserHeight:
      round2(actualRiserIn),

    riserCount,

    treadDepth:
      treadDepthIn,

    flightCount,

    staircaseWidth:
      staircaseWidthFt,

    totalRun:
      round2(totalRunFt),

    valid,

    message: valid
      ? "Staircase fits available space."
      : "Staircase requires alternate configuration.",
  };
}

// ============================================================
// DOOR / WINDOW ENGINE
// ============================================================

export interface OpeningResult {
  doorCount: number;

  windowCount: number;

  mainDoorWidthFt: number;

  mainDoorHeightFt: number;

  internalDoorWidthFt: number;

  internalDoorHeightFt: number;

  windowWidthFt: number;

  windowHeightFt: number;
}

export function calculateOpenings(
  roomCount: number,
  floorArea: number
): OpeningResult {
  let doorCount =
    Math.max(
      1,
      Math.ceil(roomCount)
    );

  /*
   * Basic planning defaults only.
   * Final sizes can later be connected to
   * jurisdiction-specific rules.
   */

  if (floorArea > 1500) {
    doorCount += 1;
  }

  const windowCount =
    Math.max(
      2,
      Math.ceil(roomCount * 2)
    );

  return {
    doorCount,

    windowCount,

    mainDoorWidthFt: 3.5,

    mainDoorHeightFt: 7,

    internalDoorWidthFt: 3,

    internalDoorHeightFt: 7,

    windowWidthFt: 4,

    windowHeightFt: 4,
  };
}

// ============================================================
// ROAD / NORTH ORIENTATION
// ============================================================

export function getNorthOrientation(
  roadSide: string
): string {
  const value =
    roadSide.toUpperCase();

  if (value.includes("NORTH")) {
    return "NORTH";
  }

  if (value.includes("SOUTH")) {
    return "SOUTH";
  }

  if (value.includes("EAST")) {
    return "EAST";
  }

  if (value.includes("WEST")) {
    return "WEST";
  }

  return "NORTH";
}

// ============================================================
// WALL THICKNESS
// ============================================================

export const WALL_RULES = {
  externalWallInch: 8,

  internalWallInch: 4,

  floorToFloorHeightFt: 10,

  plinthHeightFt: 1.5,
};

// ============================================================
// DRAWING SCALE
// ============================================================

export function getDrawingScale(
  plotWidthFt: number,
  plotLengthFt: number,
  maxWidthPx = 900,
  maxHeightPx = 650
) {
  const width =
    Math.max(
      1,
      safeNumber(plotWidthFt)
    );

  const length =
    Math.max(
      1,
      safeNumber(plotLengthFt)
    );

  const scaleX =
    maxWidthPx / width;

  const scaleY =
    maxHeightPx / length;

  return Math.min(
    scaleX,
    scaleY
  );
}