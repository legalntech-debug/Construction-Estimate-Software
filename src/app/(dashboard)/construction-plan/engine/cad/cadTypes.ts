import { PlotDimensions, PlotShape } from "../types";

// --- BASIC INPUT TYPES ---
export type RoomInput = {
  selected?: boolean;
  count?: number;
  areaMode?: "AUTO" | "MANUAL";
  areaPerRoom?: number;
};

export type RoomDetails = Record<string, RoomInput>;

export type FloorDetails = Record<
  string,
  {
    length?: number;
    width?: number;
    area?: number;
  }
>;

// --- GEOMETRY & STRUCTURAL TYPES ---
export type Point2D = { x: number; y: number };

export type VastuZone = "NE" | "N" | "NW" | "W" | "SW" | "S" | "SE" | "E" | "CENTER";

export type WallThickness = 9 | 4; // 9" Load Bearing Outer Wall, 4.5" Interior Partition Wall

export interface WallSegment {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: WallThickness;
  isOuter: boolean;
  associatedRoomIds?: string[];
}

export interface StructuralColumn {
  id: string;
  x: number;
  y: number;
  width: number;  // Standard 9"
  depth: number;  // Standard 12" or 15"
  rotation: 0 | 90;
}

export type DoorSwingDirection = "IN_LEFT" | "IN_RIGHT" | "OUT_LEFT" | "OUT_RIGHT";

export interface CADOpening {
  id: string;
  wallId: string;
  type: "DOOR" | "WINDOW" | "VENTILATOR" | "ARCH";
  positionOnWall: number; // Start offset along the wall line (in inches/feet)
  width: number;          // Door/Window width (e.g., 36" Door, 48" Window)
  sillHeight?: number;    // Window elevation level
  swing?: DoorSwingDirection;
  label?: string;         // e.g. 'D1', 'W1', 'V1'
}

export interface DimensionLine {
  id: string;
  start: Point2D;
  end: Point2D;
  text: string;           // e.g. "12'-0\""
  offsetDistance: number; // Distance from wall for drafting alignment
  type: "ROOM_INNER" | "BUILDING_OUTER" | "GRID_AXIS";
}

export interface FurniturePlacement {
  id: string;
  type: "BED" | "SOFA" | "DINING_TABLE" | "KITCHEN_COUNTER" | "WC" | "BASIN";
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
}

// --- ARCHITECTURAL BLUEPRINT TYPES ---
export type BlueprintRoom = {
  id: string;
  name: string;
  sourceKey: string;
  index: number;

  // Inner Room Bounding Coordinates
  x: number;
  y: number;
  w: number;
  h: number;

  area: string;                 // e.g. "150 SQ FT"
  formattedDimension?: string;  // e.g. "10'-0\" X 15'-0\""
  vastuZone?: VastuZone;

  wallIds?: string[];
  furniture?: FurniturePlacement[];

  // Legacy Compatibility Flags
  hasDoor?: boolean;
  hasWindow?: boolean;
  doorSide?: "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  isStairs?: boolean;
  isParking?: boolean;
  isBoundary?: boolean;
  isBalcony?: boolean;
};

export type BlueprintFloor = {
  floorName: string;
  floorArea: number;
  rooms: BlueprintRoom[];
  
  // Structural & Architectural CAD Data
  walls?: WallSegment[];
  columns?: StructuralColumn[];
  openings?: CADOpening[];
  dimensions?: DimensionLine[];
};

export type CadBlueprint = {
  viewBox: string;

  plotWidth: number;
  plotDepth: number;

  buildableX: number;
  buildableY: number;
  buildableWidth: number;
  buildableDepth: number;

  sitePlan: {
    boundary: {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    topNeighbor: string;
    leftNeighbor: string;
    rightNeighbor: string;
    bottomNeighbor: string;
  };

  floors: Record<string, BlueprintFloor>;

  getRoomsForFloor: (floorName: string) => BlueprintRoom[];
};