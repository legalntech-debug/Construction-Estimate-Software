/* =========================================================
CONSTRUCTION PLAN SYSTEM — SECTION ENGINE
---------------------------------------------------------
Computes vertical X-X sectional layers from foundation 
up to the terrace roof level.
========================================================= */

export type SectionLayer = {
  element: string;
  levelFeet: number;
  thicknessFeet: number;
};

export function calculateSectionProfile(
  selectedFloors: string[],
  floorHeightFeet: number = 10
): SectionLayer[] {
  const profile: SectionLayer[] = [];
  
  // 1. Foundation Level
  profile.push({
    element: "FOUNDATION / FOOTING",
    levelFeet: -4.0,
    thicknessFeet: 4.0,
  });

  // 2. Plinth Level
  profile.push({
    element: "PLINTH LEVEL",
    levelFeet: 0.0,
    thicknessFeet: 2.0,
  });

  let currentLevel = 2.0;

  // 3. Floors & Slabs
  selectedFloors.forEach((floor) => {
    profile.push({
      element: `${floor} SLAB & FLOOR`,
      levelFeet: currentLevel,
      thicknessFeet: floorHeightFeet,
    });
    currentLevel += floorHeightFeet;
  });

  // 4. Roof / Terrace
  profile.push({
    element: "ROOF SLAB & PARAPET",
    levelFeet: currentLevel,
    thicknessFeet: 3.5,
  });

  return profile;
}