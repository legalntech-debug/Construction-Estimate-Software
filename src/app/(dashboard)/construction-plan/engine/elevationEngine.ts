/* =========================================================
CONSTRUCTION PLAN SYSTEM — ELEVATION ENGINE
---------------------------------------------------------
Computes vertical facade segments based on floor height.
========================================================= */

export type ElevationLayer = {
  element: string;
  levelFeet: number;
  heightFeet: number;
};

export function calculateElevationProfile(
  selectedFloors: string[],
  floorHeightFeet: number = 10
): ElevationLayer[] {
  const profile: ElevationLayer[] = [];
  
  // 1. Plinth/Ground Level
  profile.push({
    element: "PLINTH LEVEL",
    levelFeet: 0.0,
    heightFeet: 2.0,
  });

  // 2. Floor Levels
  selectedFloors.forEach((floor, index) => {
    profile.push({
      element: `${floor} FACADE`,
      levelFeet: 2.0 + (index * floorHeightFeet),
      heightFeet: floorHeightFeet,
    });
  });

  // 3. Roof Parapet
  profile.push({
    element: "PARAPET / ROOF",
    levelFeet: 2.0 + (selectedFloors.length * floorHeightFeet),
    heightFeet: 3.5,
  });

  return profile;
}