/*
 * Construction Plan Engine — domain types.
 *
 * The public form is intentionally non-CAD. CAD primitives remain an internal
 * rendering format only. Geometry is always stored in real-world feet.
 */

export type PlotShape =
  | "RECTANGULAR"
  | "SQUARE"
  | "TRAPEZOIDAL"
  | "TRIANGULAR"
  | "L-SHAPE"
  | "POLYGON"
  | "IRREGULAR / L-SHAPE";

export type PlotSide = "A" | "B" | "C" | "D";
export type CardinalDirection = "NORTH" | "SOUTH" | "EAST" | "WEST";
export type CoverageType = "100_PERCENT" | "AS_PER_NORMS" | "CUSTOM_PERCENT";

export type PlotDimensions = {
  A: number; // front / road side
  B: number; // rear / opposite side
  C: number; // left side
  D: number; // right side
};

export type PlotVertex = { x: number; y: number };

export type Boundaries = {
  north: string;
  south: string;
  east: string;
  west: string;
};

export type SetbackValues = {
  front: number;
  rear: number;
  left: number;
  right: number;
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
  | "NORTH" | "NE" | "EAST" | "SE" | "SOUTH" | "SW" | "WEST" | "NW" | "CENTRE";

export type VastuAssessment = {
  zone: VastuDirection;
  status: "GOOD" | "ALTERNATIVE ZONE" | "NOT RECOMMENDED";
  note: string;
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
  source: "USER_INPUT" | "LOCAL_RULES" | "DEFAULT_UNSPECIFIED";
};

export type Point = { x: number; y: number };
export type Polygon = Point[];

export type PlotGeometry = {
  shape: PlotShape;
  vertices: Polygon;
  area: number;
  perimeter: number;
  width: number;
  depth: number;
  valid: boolean;
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

export type CadPoint = Point;

/* Internal drawing primitives. These are NOT the user-facing CAD tools. */
export type CadTool =
  | "SELECT" | "LINE" | "PLINE" | "RECTANGLE" | "OFFSET" | "MOVE"
  | "COPY" | "ROTATE" | "DELETE" | "DIMENSION" | "TEXT" | "HATCH";

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
  plot_vertices?: PlotVertex[];
  plot_angles?: { A: number; B: number; C: number; D: number };
  facing?: CardinalDirection;
  road_side: string;
  road_width_feet?: number;
  boundaries: Boundaries;
  coverage_type: CoverageType | string;
  coverage_percentage?: number;
  setbacks?: SetbackValues;
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
  external_wall_thickness_inches?: number;
  internal_wall_thickness_inches?: number;
  door_count: number;
  window_count: number;
  cad_objects: CadObject[];
  cad_settings: { orth_mode: boolean; osnap_mode: boolean };
  created_at: string;
};
