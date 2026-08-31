/* =========================================================
   ROAD / SHEET ORIENTATION ENGINE
   - The selected MAIN road is always rendered at the BOTTOM.
   - Corner plots keep the second road on the corresponding side.
   - Room planning uses this normalized local sheet orientation.
========================================================= */

export type CardinalDirection = "NORTH" | "SOUTH" | "EAST" | "WEST";
export type LocalSide = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

export interface RoadOrientationInfo {
  mainRoad: CardinalDirection;
  sideRoads: CardinalDirection[];
  rotationDeg: number;
  bottomCardinal: CardinalDirection;
  topCardinal: CardinalDirection;
  leftCardinal: CardinalDirection;
  rightCardinal: CardinalDirection;
  mainLocalSide: "BOTTOM";
  sideLocalSides: Record<CardinalDirection, LocalSide>;
  isCorner: boolean;
}

const DIRS: CardinalDirection[] = ["NORTH", "SOUTH", "EAST", "WEST"];

export function parseRoadDirections(value = ""): { mainRoad: CardinalDirection; roads: CardinalDirection[] } {
  const raw = String(value || "").toUpperCase();
  const mainMatch = raw.match(/MAIN\s*RD\s*(NORTH|SOUTH|EAST|WEST)/);

  const occurrences: { dir: CardinalDirection; index: number }[] = [];
  for (const dir of DIRS) {
    const index = raw.indexOf(dir);
    if (index >= 0) occurrences.push({ dir, index });
  }
  occurrences.sort((a, b) => a.index - b.index);

  const roads: CardinalDirection[] = [];
  for (const { dir } of occurrences) {
    if (!roads.includes(dir)) roads.push(dir);
  }

  const mainRoad = (mainMatch?.[1] as CardinalDirection) || roads[0] || "SOUTH";
  if (!roads.includes(mainRoad)) roads.unshift(mainRoad);

  return { mainRoad, roads };
}

export function getRoadOrientation(value = ""): RoadOrientationInfo {
  const { mainRoad, roads } = parseRoadDirections(value);

  const maps: Record<CardinalDirection, Omit<RoadOrientationInfo, "mainRoad" | "sideRoads" | "isCorner">> = {
    SOUTH: {
      rotationDeg: 0,
      bottomCardinal: "SOUTH",
      topCardinal: "NORTH",
      leftCardinal: "WEST",
      rightCardinal: "EAST",
      mainLocalSide: "BOTTOM",
      sideLocalSides: { NORTH: "TOP", SOUTH: "BOTTOM", EAST: "RIGHT", WEST: "LEFT" },
    },
    NORTH: {
      rotationDeg: 180,
      bottomCardinal: "NORTH",
      topCardinal: "SOUTH",
      leftCardinal: "EAST",
      rightCardinal: "WEST",
      mainLocalSide: "BOTTOM",
      sideLocalSides: { NORTH: "BOTTOM", SOUTH: "TOP", EAST: "LEFT", WEST: "RIGHT" },
    },
    EAST: {
      rotationDeg: 90,
      bottomCardinal: "EAST",
      topCardinal: "WEST",
      leftCardinal: "SOUTH",
      rightCardinal: "NORTH",
      mainLocalSide: "BOTTOM",
      sideLocalSides: { NORTH: "RIGHT", SOUTH: "LEFT", EAST: "BOTTOM", WEST: "TOP" },
    },
    WEST: {
      rotationDeg: 270,
      bottomCardinal: "WEST",
      topCardinal: "EAST",
      leftCardinal: "NORTH",
      rightCardinal: "SOUTH",
      mainLocalSide: "BOTTOM",
      sideLocalSides: { NORTH: "LEFT", SOUTH: "RIGHT", EAST: "TOP", WEST: "BOTTOM" },
    },
  };

  const base = maps[mainRoad];
  return {
    mainRoad,
    sideRoads: roads.filter((d) => d !== mainRoad),
    isCorner: roads.length >= 2,
    ...base,
  };
}
