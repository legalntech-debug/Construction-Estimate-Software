/* =========================================================
CONSTRUCTION PLAN SYSTEM — CORE TYPES
---------------------------------------------------------
This file defines all data structures for the planning engine,
rulesets, validation, CAD integration, and final 80:20 sheet layout.
========================================================= */

export type PlotShape =
  | "RECTANGULAR"
  | "SQUARE"
  | "IRREGULAR / L-SHAPE"
  | "TRAPEZOIDAL"
  | "POLYGON";

export type PlotSide = "A" | "B" | "C" | "D";

export type PlotDimensions = {
  A: number; // Front / Road / Bottom side
  B: number; // Opposite side
  C: number; // Left side
  D: number; // Right side
};

export type Boundaries = {
  north: string;
  south: string;
  east: string;
  west: string;
};

export type FloorData = {
  length: number;
  width: number;
  area: number;
};

export type AreaMode = "AUTO" | "MANUAL";

export type FloorRoom = {
  selected: boolean;
  count: number;
  areaMode: AreaMode;
  areaPerRoom: number;
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

export type VastuDirection =
  | "NORTH"
  | "NE"
  | "EAST"
  | "SE"
  | "SOUTH"
  | "SW"
  | "WEST"
  | "NW"
  | "CENTRE";

export type VastuAssessment = {
  zone: VastuDirection;
  status: "GOOD" | "ALTERNATIVE ZONE" | "NOT RECOMMENDED";
  note: string;
};

export type StaircaseSpec = {
  floorToFloorHeight: number; // e.g., 10 feet
  targetRiserInches: number; // e.g., 7 inches
  riserCount: number;
  actualRiserInches: number;
  treadInches: number; // e.g., 10 or 12 inches
  flightCount: number;
  landingWidth: number;
  staircaseWidth: number;
  totalLengthNeeded: number;
  status: "OPTIMAL" | "COMPACT" | "CHECK REQUIRED";
};

export type DoorWindowSpec = {
  mainDoors: number;
  internalDoors: number;
  bathroomDoors: number;
  windows: number;
  ventilators: number;
};

export type SetbackRuleset = {
  frontSetback: number;
  rearSetback: number;
  leftSetback: number;
  rightSetback: number;
  maxCoveragePercentage: number;
  maxBuildingHeight: number;
};

export type CadPoint = {
  x: number;
  y: number;
};

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

export type CadObject = {
  id: string;
  type: "LINE" | "POLYLINE" | "RECTANGLE" | "TEXT" | "HATCH" | "DIMENSION";
  points: CadPoint[];
  text?: string;
  layer?: string;
  rotation?: number;
};

export type ConstructionPlanPayload = {
  ref_no: string;
  customer_name: string;
  client_name: string;
  representative: string;
  property_address: string;
  case_type: string;
  plot_shape: PlotShape;
  plot_area: number;
  dimensions: PlotDimensions;
  road_side: string;
  boundaries: Boundaries;
  coverage_type: string;
  selected_floors: string[];
  floor_details: Record<string, FloorData>;
  room_details: Record<string, Record<string, FloorRoom>>;
  floor_room_totals: Record<string, number>;
  total_room_area: number;
  total_builtup_area: number;
  rate_per_sqft: number;
  total_value: number;
  fee_amount: number;
  fee_mode: "AUTO" | "MANUAL";
  door_count: number;
  window_count: number;
  cad_objects: CadObject[];
  cad_settings: {
    orth_mode: boolean;
    osnap_mode: boolean;
  };
  created_at: string;
};