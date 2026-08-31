/* =========================================================
CONSTRUCTION PLAN SYSTEM — TYPES ENGINE
========================================================= */

export type PlanningMode = "AUTO" | "MANUAL" | "PRESET";

export type CadTool =
  | "SELECT"
  | "LINE"
  | "PLINE"
  | "RECTANGLE"
  | "OFFSET"
  | "MOVE"
  | "COPY"
  | "ROTATE"
  | "DELETE"
  | "DIMENSION"
  | "TEXT"
  | "HATCH";

export type PlotDimensions = {
  length: number;
  width: number;
  area: number;
  A?: number;
  B?: number;
  C?: number;
  D?: number;
  E?: number;
  F?: number;
  [key: string]: any;
};

export type PlotShape =
  | "RECTANGULAR"
  | "SQUARE"
  | "TRAPEZOIDAL"
  | "IRREGULAR"
  | "POLYGON"
  | "L-SHAPE"
  | "L-SHAPE (TYPE 1: FRONT-LEFT CUT)"
  | "L-SHAPE (TYPE 2: FRONT-RIGHT CUT)"
  | "L-SHAPE (TYPE 3: REAR-LEFT CUT)"
  | "L-SHAPE (TYPE 4: REAR-RIGHT CUT)";

export type Polygon = Array<{ x: number; y: number }>;

export type SetbackValues = {
  front: number;
  rear: number;
  left: number;
  right: number;
};

export type CoverageType = "100_PERCENT" | "AS_PER_NORMS" | string;

export type SetbackRuleset = {
  frontSetback: number;
  rearSetback: number;
  leftSetback: number;
  rightSetback: number;
  maxCoveragePercentage: number;
  maxBuildingHeight: number;
  source: "USER_INPUT" | "DEFAULT_UNSPECIFIED" | string;
};

export type PlotGeometry = {
  valid: boolean;
  shape: PlotShape;
  vertices: Polygon;
  area: number;
  perimeter: number;
  width: number;
  depth: number;
  errors: string[];
};

export type BuildableGeometry = {
  plot: PlotGeometry;
  buildablePolygon: Polygon;
  buildableArea: number;
  coveragePercentage: number;
  setbacks: SetbackValues;
  warnings: string[];
};

export type VastuDirection = "NE" | "N" | "NW" | "W" | "SW" | "S" | "SE" | "E" | "CENTER";

export type VastuAssessment = {
  zone: VastuDirection;
  status: "GOOD" | "ALTERNATIVE ZONE" | "NOT RECOMMENDED" | string;
  note: string;
};

export interface ConstructionPlanPayload {
  customer_name: string;
  property_address: string;
  plot_area: number;
  total_builtup_area: number;
  total_room_area: number;
  [key: string]: any;
}

export type WallSide = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

// Exporting DoorPosition required by FloorPlanningSettings
export type DoorPosition = WallSide | "NORTH" | "SOUTH" | "EAST" | "WEST";

export type PlacedDoor = {
  id: string;
  wall: WallSide;
  offsetFeet: number;
  widthFeet: number;
  doorType: "MAIN" | "INTERNAL" | "BATHROOM" | "SHUTTER";
  renderSymbol?: boolean;
  sharedOpeningId?: string;
};

export type PlacedWindow = {
  id: string;
  wall: WallSide;
  offsetFeet: number;
  lengthFeet: number;
  windowType: "STANDARD" | "VENTILATOR" | "FRENCH";
};

export type RoomDefinition = {
  key: string;
  label: string;
  minArea: number;
  defaultArea: number;
  minWidth: number;
  statutoryMinArea?: number;
  percentageRule?: number;
};

export type FloorData = {
  length: number;
  width: number;
  area: number;
};

export type DoorWindowSpec = {
  mainDoors: number;
  internalDoors: number;
  bathroomDoors: number;
  windows: number;
  ventilators: number;
};

export type StaircaseSpec = {
  floorToFloorHeight: number;
  targetRiserInches: number;
  riserCount: number;
  actualRiserInches: number;
  treadInches: number;
  flightCount: number;
  landingWidth: number;
  staircaseWidth: number;
  totalLengthNeeded: number;
  status: "OPTIMAL" | "COMPACT" | "CHECK REQUIRED";
};

export interface FloorPlanningSettings {
  // Mode & Presets
  mode?: PlanningMode;
  planningMode?: PlanningMode;
  bhkPreset?: string;
  allowCustomRooms?: boolean;

  // Door & Window Counts
  mainDoorCount?: number;
  internalDoorCount?: number;
  bathroomDoorCount?: number;
  windowCount?: number;
  ventilatorCount?: number;

  // Main Door Settings
  mainDoorPosition?: DoorPosition;
  mainDoorOffsetFeet?: number;
  doorWidthFeet?: number;
  doorHeightFeet?: number;

  // Structural & Level Heights
  floorToFloorHeightFeet?: number;
  ceilingHeightFeet?: number;
  plinthHeightFeet?: number;
  plinthLevelFeet?: number;

  // Index signature to allow dynamic key access (keyof FloorPlanningSettings)
  [key: string]: any;
}

export const DEFAULT_FLOOR_PLANNING_SETTINGS: FloorPlanningSettings = {
  mode: "AUTO",
  planningMode: "AUTO",
  bhkPreset: "2 BHK",
  allowCustomRooms: true,
  mainDoorCount: 1,
  internalDoorCount: 4,
  bathroomDoorCount: 2,
  windowCount: 4,
  ventilatorCount: 2,
  mainDoorPosition: "BOTTOM",
  mainDoorOffsetFeet: 2,
  doorWidthFeet: 3,
  doorHeightFeet: 7,
  floorToFloorHeightFeet: 10,
  ceilingHeightFeet: 9.5,
  plinthHeightFeet: 2,
  plinthLevelFeet: 2,
};

export type RoomCategory =
  | "bedroom"
  | "living"
  | "kitchen"
  | "toilet"
  | "stairs"
  | "parking"
  | "multi_use_front"
  | "garden"
  | "duct";

/**
 * Unified FloorRoom Interface
 * Supports both selection state and 2D canvas placement properties.
 */
export interface FloorRoom {
  // Selection / Form Config Properties
  selected?: boolean;
  count?: number;
  areaMode?: "AUTO" | "MANUAL";
  areaPerRoom?: number;

  // Positioned Layout Box & Canvas Properties
  id?: string;
  name?: string;
  label?: string;
  roomType?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  type?: RoomCategory | string;
  isCovered?: boolean;
  doors?: PlacedDoor[] | any[];
  windows?: PlacedWindow[] | any[];
}

export interface GeneratedFloorPlanModel {
  floorName: string;
  width: number;
  length: number;
  area: number;
  buildableArea: number;
  originX: number;
  originY: number;
  rooms: FloorRoom[];
  walls?: any[];
  columns?: any[];
  openings?: any[];
  dimensions?: any[];
  staircase?: any;
  warnings?: string[];
  errors?: string[];
}

export interface GeneratedConstructionPlanModel {
  plotGeometry: any;
  setbackRules: any;
  buildableGeometry: any;
  plotArea: number;
  selectedFloors: string[];
  floors: Record<string, GeneratedFloorPlanModel>;
  floorData: Record<string, any>;
  floorRooms: Record<string, FloorRoom[]>;
  elevation: any[];
  section: any[];
  generatedAt: string;
}