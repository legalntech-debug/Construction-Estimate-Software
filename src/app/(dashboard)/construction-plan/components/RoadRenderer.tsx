import React from "react";

interface RoadRendererProps {
  roadFacingOption: string;
  bottomBoundary: string;
  topBoundary: string;
  boundaryEast: string;
  boundaryWest: string;
  pTopLeft: { x: number; y: number };
  pTopRight: { x: number; y: number };
  pBottomLeft: { x: number; y: number };
  pBottomRight: { x: number; y: number };
  roadWidthNorth?: number;
  roadWidthSouth?: number;
  roadWidthEast?: number;
  roadWidthWest?: number;
  roadWidth?: number;
}

const SCALE = 5.5;
export const SITE_LAYOUT_GAP = 20;

export default function RoadRenderer({
  roadFacingOption,
  bottomBoundary,
  topBoundary,
  boundaryEast,
  boundaryWest,
  pTopLeft,
  pTopRight,
  pBottomLeft,
  pBottomRight,
  roadWidthNorth,
  roadWidthSouth,
  roadWidthEast,
  roadWidthWest,
  roadWidth = 15,
}: RoadRendererProps) {
  const opt = (roadFacingOption || "").toUpperCase();

  const isFourSide = opt.includes("4 SIDE");
  const isThreeSide = opt.includes("3 SIDE");
  const isTwoSide = opt.includes("2 SIDE") || opt.includes("FRONT & REAR");

  const allDirs = ["NORTH", "SOUTH", "EAST", "WEST"];
  const foundDirs: { dir: string; index: number }[] = [];

  allDirs.forEach((dir) => {
    const idx = opt.indexOf(dir);
    if (idx !== -1) {
      foundDirs.push({ dir, index: idx });
    }
  });

  foundDirs.sort((a, b) => a.index - b.index);

  let mainRoad = "SOUTH";
  if (foundDirs.length > 0) {
    mainRoad = foundDirs[0].dir;
  }

  const compassMap: Record<
    string,
    { top: string; left: string; right: string }
  > = {
    NORTH: { top: "SOUTH", left: "EAST", right: "WEST" },
    SOUTH: { top: "NORTH", left: "WEST", right: "EAST" },
    EAST: { top: "WEST", left: "SOUTH", right: "NORTH" },
    WEST: { top: "EAST", left: "NORTH", right: "SOUTH" },
  };

  const currentCompass = compassMap[mainRoad] || compassMap["SOUTH"];
  const activeDirs = foundDirs.map((d) => d.dir);

  let hasBottomRoad = false;
  let hasTopRoad = false;
  let hasLeftRoad = false;
  let hasRightRoad = false;

  if (isFourSide) {
    hasBottomRoad = true;
    hasTopRoad = true;
    hasLeftRoad = true;
    hasRightRoad = true;
  } else if (isThreeSide) {
    hasBottomRoad = activeDirs.includes(mainRoad) || foundDirs.length >= 1;
    hasTopRoad    = activeDirs.includes(currentCompass.top);
    hasLeftRoad   = activeDirs.includes(currentCompass.left);
    hasRightRoad  = activeDirs.includes(currentCompass.right);
  } else if (isTwoSide || opt.includes("FRONT & REAR")) {
    hasBottomRoad = activeDirs.includes(mainRoad);
    hasTopRoad    = activeDirs.includes(currentCompass.top);
    hasLeftRoad   = false;
    hasRightRoad  = false;
  } else if (opt.includes("CORNER") || (foundDirs.length === 2 && !opt.includes("FRONT & REAR"))) {
    hasBottomRoad = activeDirs.includes(mainRoad);
    hasTopRoad    = false;
    hasLeftRoad   = activeDirs.includes(currentCompass.left);
    hasRightRoad  = activeDirs.includes(currentCompass.right);
  } else {
    hasBottomRoad = true;
    hasTopRoad    = false;
    hasLeftRoad   = false;
    hasRightRoad  = false;
  }

  const getWidthForDir = (dir: string) => {
    let w = roadWidth;
    if (dir === "NORTH") w = Number(roadWidthNorth) > 0 ? Number(roadWidthNorth) : roadWidth;
    if (dir === "SOUTH") w = Number(roadWidthSouth) > 0 ? Number(roadWidthSouth) : roadWidth;
    if (dir === "EAST")  w = Number(roadWidthEast) > 0 ? Number(roadWidthEast) : roadWidth;
    if (dir === "WEST")  w = Number(roadWidthWest) > 0 ? Number(roadWidthWest) : roadWidth;
    return Number.isFinite(w) && w > 0 ? w * SCALE : roadWidth * SCALE;
  };

  const bottomDirHeight = getWidthForDir(mainRoad);
  const topDirHeight    = getWidthForDir(currentCompass.top);
  const leftDirHeight   = getWidthForDir(currentCompass.left);
  const rightDirHeight  = getWidthForDir(currentCompass.right);

  const ext = 6 * SCALE;
  const siteLayoutY = pBottomLeft.y + bottomDirHeight + SITE_LAYOUT_GAP;

  // ==========================================
  // ORTHOGONAL (90-DEGREE) RECTANGLE ROAD GEOMETRY
  // ==========================================

  // Left & Right Side Road Boundaries
  const lLeft = pTopLeft.x - leftDirHeight;
  const lRight = pTopLeft.x;
  const rLeft = pBottomRight.x;
  const rRight = pBottomRight.x + rightDirHeight;

  // Bottom Road Box (Updated: 6' extra extension on both sides even if side road is absent)
  const bLeft = hasLeftRoad ? lLeft - ext : pBottomLeft.x - ext;
  const bRight = hasRightRoad ? rRight + ext : pBottomRight.x + ext;
  const bTop = pBottomLeft.y;
  const bBottom = pBottomLeft.y + bottomDirHeight;

  // Top Road Box
  const tLeft = pTopLeft.x - (hasLeftRoad ? leftDirHeight + ext : ext);
  const tRight = pTopRight.x + (hasRightRoad ? rightDirHeight + ext : ext);
  const tBottom = pTopLeft.y;
  const tTop = pTopLeft.y - topDirHeight;

  // Left Road Box
  const lTop = hasTopRoad ? tTop : pTopLeft.y - ext;

  // Right Road Box
  const rTop = hasTopRoad ? tTop : pTopRight.y - ext;

  return (
    <>
      {/* 1. BOTTOM ROAD */}
      {hasBottomRoad && (
        <>
          <line x1={bLeft} y1={bBottom} x2={bRight} y2={bBottom} stroke="#ffffff" strokeWidth="1" />
          
          {hasLeftRoad ? (
            <line x1={bLeft} y1={bTop} x2={bLeft} y2={bBottom} stroke="#ffffff" strokeWidth="1" />
          ) : (
            <line x1={bLeft} y1={bTop} x2={bLeft} y2={bBottom} stroke="#ffffff" strokeWidth="1" />
          )}

          {hasRightRoad ? (
            <line x1={bRight} y1={bTop} x2={bRight} y2={bBottom} stroke="#ffffff" strokeWidth="1" />
          ) : (
            <line x1={bRight} y1={bTop} x2={bRight} y2={bBottom} stroke="#ffffff" strokeWidth="1" />
          )}
          
          {/* Left Extension Top Line */}
          {hasLeftRoad ? (
            <line x1={bLeft} y1={bTop} x2={lLeft} y2={bTop} stroke="#ffffff" strokeWidth="1" />
          ) : (
            <line x1={bLeft} y1={bTop} x2={pBottomLeft.x} y2={bTop} stroke="#ffffff" strokeWidth="1" />
          )}

          {/* Main Front Plot Road Line */}
          <line
            x1={pBottomLeft.x}
            y1={bTop}
            x2={pBottomRight.x}
            y2={bTop}
            stroke="#ffffff"
            strokeWidth="1"
          />

          {/* Right Extension Top Line */}
          {hasRightRoad ? (
            <line x1={rRight} y1={bTop} x2={bRight} y2={bTop} stroke="#ffffff" strokeWidth="1" />
          ) : (
            <line x1={pBottomRight.x} y1={bTop} x2={bRight} y2={bTop} stroke="#ffffff" strokeWidth="1" />
          )}
        </>
      )}

      {/* 2. TOP ROAD */}
      {hasTopRoad && (
        <>
          <line x1={tLeft} y1={tTop} x2={tRight} y2={tTop} stroke="#ffffff" strokeWidth="1" />
          <line x1={tLeft} y1={tBottom} x2={tLeft} y2={tTop} stroke="#ffffff" strokeWidth="1" />
          <line x1={tRight} y1={tBottom} x2={tRight} y2={tTop} stroke="#ffffff" strokeWidth="1" />
          <line
            x1={hasLeftRoad ? pTopLeft.x : tLeft}
            y1={tBottom}
            x2={hasRightRoad ? pTopRight.x : tRight}
            y2={tBottom}
            stroke="#ffffff"
            strokeWidth="1"
          />
        </>
      )}

      {/* 3. LEFT SIDE ROAD */}
      {hasLeftRoad && (
        <>
          <line x1={lLeft} y1={lTop} x2={lLeft} y2={bTop} stroke="#ffffff" strokeWidth="1" />
          <line x1={lLeft} y1={lTop} x2={lRight} y2={lTop} stroke="#ffffff" strokeWidth="1" />
          <line
            x1={lRight}
            y1={hasTopRoad ? pTopLeft.y : lTop}
            x2={lRight}
            y2={bTop}
            stroke="#ffffff"
            strokeWidth="1"
          />
        </>
      )}

      {/* 4. RIGHT SIDE ROAD */}
      {hasRightRoad && (
        <>
          <line x1={rRight} y1={rTop} x2={rRight} y2={bTop} stroke="#ffffff" strokeWidth="1" />
          <line x1={rLeft} y1={rTop} x2={rRight} y2={rTop} stroke="#ffffff" strokeWidth="1" />
          <line
            x1={rLeft}
            y1={hasTopRoad ? pTopRight.y : rTop}
            x2={rLeft}
            y2={bTop}
            stroke="#ffffff"
            strokeWidth="1"
          />
        </>
      )}

      <g data-site-layout-y={siteLayoutY} />
    </>
  );
}

export function getRoadHeightsByDirection(
  roadFacingOption: string = "",
  roadWidthNorth?: number,
  roadWidthSouth?: number,
  roadWidthEast?: number,
  roadWidthWest?: number,
  roadWidth: number = 15
) {
  const getW = (dir: string) => {
    let w = roadWidth;
    if (dir === "NORTH") w = Number(roadWidthNorth) > 0 ? Number(roadWidthNorth) : roadWidth;
    if (dir === "SOUTH") w = Number(roadWidthSouth) > 0 ? Number(roadWidthSouth) : roadWidth;
    if (dir === "EAST")  w = Number(roadWidthEast) > 0 ? Number(roadWidthEast) : roadWidth;
    if (dir === "WEST")  w = Number(roadWidthWest) > 0 ? Number(roadWidthWest) : roadWidth;
    return Number.isFinite(w) && w > 0 ? w * SCALE : roadWidth * SCALE;
  };

  return {
    north: getW("NORTH"),
    south: getW("SOUTH"),
    east: getW("EAST"),
    west: getW("WEST"),
  };
}

export function getSiteLayoutY(
  plotBottomY: number,
  roadWidth: number = 15,
  hasBottomRoad: boolean = true,
  roadFacingOption: string = "",
  roadWidthNorth?: number,
  roadWidthSouth?: number,
  roadWidthEast?: number,
  roadWidthWest?: number
): number {
  if (!hasBottomRoad) {
    return plotBottomY + SITE_LAYOUT_GAP;
  }

  const opt = (roadFacingOption || "").toUpperCase();
  const allDirs = ["NORTH", "SOUTH", "EAST", "WEST"];
  const foundDirs: { dir: string; index: number }[] = [];
  allDirs.forEach((dir) => {
    const idx = opt.indexOf(dir);
    if (idx !== -1) foundDirs.push({ dir, index: idx });
  });
  foundDirs.sort((a, b) => a.index - b.index);

  let mainRoad = "SOUTH";
  if (foundDirs.length > 0) mainRoad = foundDirs[0].dir;

  let bottomRoadWidth = roadWidth;
  if (mainRoad === "NORTH") bottomRoadWidth = Number(roadWidthNorth) > 0 ? Number(roadWidthNorth) : roadWidth;
  else if (mainRoad === "SOUTH") bottomRoadWidth = Number(roadWidthSouth) > 0 ? Number(roadWidthSouth) : roadWidth;
  else if (mainRoad === "EAST") bottomRoadWidth = Number(roadWidthEast) > 0 ? Number(roadWidthEast) : roadWidth;
  else if (mainRoad === "WEST") bottomRoadWidth = Number(roadWidthWest) > 0 ? Number(roadWidthWest) : roadWidth;

  const bottomRoadHeight = Number.isFinite(Number(bottomRoadWidth)) && Number(bottomRoadWidth) > 0
    ? Number(bottomRoadWidth) * SCALE
    : roadWidth * SCALE;

  return plotBottomY + bottomRoadHeight + SITE_LAYOUT_GAP;
}

export function getCompassOffset(
  roadFacingOption: string = "",
  roadWidthNorth?: number,
  roadWidthSouth?: number,
  roadWidthEast?: number,
  roadWidthWest?: number,
  roadWidth: number = 15
): { xOffset: number; yOffset: number } {
  const heights = getRoadHeightsByDirection(roadFacingOption, roadWidthNorth, roadWidthSouth, roadWidthEast, roadWidthWest, roadWidth);
  return {
    xOffset: heights.east * 0.1,
    yOffset: heights.north * 0.1,
  };
}

export function getPlanningAreaOffset(
  roadFacingOption: string = "",
  roadWidthNorth?: number,
  roadWidthSouth?: number,
  roadWidthEast?: number,
  roadWidthWest?: number,
  roadWidth: number = 15
): number {
  const heights = getRoadHeightsByDirection(roadFacingOption, roadWidthNorth, roadWidthSouth, roadWidthEast, roadWidthWest, roadWidth);
  return heights.west;
}

export function getRoadHeight(roadWidth: number = 15): number {
  const safeRoadWidth =
    Number.isFinite(Number(roadWidth)) &&
    Number(roadWidth) > 0
      ? Number(roadWidth)
      : 15;

  return safeRoadWidth * SCALE;
}