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

// Road ke baad SITE LAYOUT ke liye fixed visual gap
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
  roadWidth = 15,
}: RoadRendererProps) {
  const opt = (roadFacingOption || "").toUpperCase();

  const safeRoadWidth =
    Number.isFinite(Number(roadWidth)) && Number(roadWidth) > 0
      ? Number(roadWidth)
      : 15;

  const roadHeight = safeRoadWidth * SCALE;
  
  // Road hamesha plot se exact 6 feet bahar nikale (6 * SCALE)
  const ext = 6 * SCALE;

  const siteLayoutY = pBottomLeft.y + roadHeight + SITE_LAYOUT_GAP;

  const isFourSide = opt.includes("4 SIDE");
  const isThreeSide = opt.includes("3 SIDE");
  const isTwoSide =
    opt.includes("2 SIDE") ||
    opt.includes("FRONT & REAR");

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
  let secondRoad = "";

  if (foundDirs.length > 0) {
    mainRoad = foundDirs[0].dir;
  }
  if (foundDirs.length > 1) {
    secondRoad = foundDirs[1].dir;
  }

  const compassMap: Record<
    string,
    { top: string; left: string; right: string }
  > = {
    NORTH: { top: "SOUTH", left: "WEST", right: "EAST" },
    SOUTH: { top: "NORTH", left: "EAST", right: "WEST" },
    EAST: { top: "WEST", left: "SOUTH", right: "NORTH" },
    WEST: { top: "EAST", left: "NORTH", right: "SOUTH" },
  };

  const currentCompass = compassMap[mainRoad] || compassMap["SOUTH"];

  let hasBottomRoad = true;
  let hasTopRoad =
    isFourSide ||
    isThreeSide ||
    isTwoSide ||
    secondRoad === currentCompass.top;

  let hasRightRoad =
    isFourSide ||
    isThreeSide ||
    secondRoad === currentCompass.right;

  let hasLeftRoad =
    isFourSide ||
    isThreeSide ||
    secondRoad === currentCompass.left;

  // ==========================================
  // 1. BOTTOM ROAD GEOMETRY
  // ==========================================
  const dxB = pBottomRight.x - pBottomLeft.x;
  const dyB = pBottomRight.y - pBottomLeft.y;
  const lenB = Math.hypot(dxB, dyB) || 1;
  const uBx = dxB / lenB;
  const uBy = dyB / lenB;
  const nxB = -uBy;
  const nyB = uBx;

  const bExtLeft = hasLeftRoad ? ext + roadHeight : ext;
  const bExtRight = hasRightRoad ? ext + roadHeight : ext;

  const bP1 = { x: pBottomLeft.x - uBx * bExtLeft, y: pBottomLeft.y - uBy * bExtLeft };
  const bP2 = { x: pBottomRight.x + uBx * bExtRight, y: pBottomRight.y + uBy * bExtRight };
  const bP3 = { x: bP2.x + nxB * roadHeight, y: bP2.y + nyB * roadHeight };
  const bP4 = { x: bP1.x + nxB * roadHeight, y: bP1.y + nyB * roadHeight };

  // ==========================================
  // 2. TOP ROAD GEOMETRY
  // ==========================================
  const dxT = pTopRight.x - pTopLeft.x;
  const dyT = pTopRight.y - pTopLeft.y;
  const lenT = Math.hypot(dxT, dyT) || 1;
  const uTx = dxT / lenT;
  const uTy = dyT / lenT;
  const nxT = uTy;
  const nyT = -uTx;

  const tExtLeft = hasLeftRoad ? ext + roadHeight : ext;
  const tExtRight = hasRightRoad ? ext + roadHeight : ext;

  const tP1 = { x: pTopLeft.x - uTx * tExtLeft, y: pTopLeft.y - uTy * tExtLeft };
  const tP2 = { x: pTopRight.x + uTx * tExtRight, y: pTopRight.y + uTy * tExtRight };
  const tP3 = { x: tP2.x + nxT * roadHeight, y: tP2.y + nyT * roadHeight };
  const tP4 = { x: tP1.x + nxT * roadHeight, y: tP1.y + nyT * roadHeight };

  // ==========================================
  // 3. LEFT ROAD GEOMETRY
  // ==========================================
  const dxL = pBottomLeft.x - pTopLeft.x;
  const dyL = pBottomLeft.y - pTopLeft.y;
  const lenL = Math.hypot(dxL, dyL) || 1;
  const uLx = dxL / lenL;
  const uLy = dyL / lenL;
  const nxL = -uLy;
  const nyL = uLx;

  const lExtTop = hasTopRoad ? ext + roadHeight : ext;
  const lExtBottom = hasBottomRoad ? 0 : ext;

  const lP1 = { x: pTopLeft.x - uLx * lExtTop, y: pTopLeft.y - uLy * lExtTop };
  const lP2 = { x: pBottomLeft.x + uLx * lExtBottom, y: pBottomLeft.y + uLy * lExtBottom };
  const lP3 = { x: lP2.x + nxL * roadHeight, y: lP2.y + nyL * roadHeight };
  const lP4 = { x: lP1.x + nxL * roadHeight, y: lP1.y + nyL * roadHeight };

  // ==========================================
  // 4. RIGHT ROAD GEOMETRY
  // ==========================================
  const dxR = pBottomRight.x - pTopRight.x;
  const dyR = pBottomRight.y - pTopRight.y;
  const lenR = Math.hypot(dxR, dyR) || 1;
  const uRx = dxR / lenR;
  const uRy = dyR / lenR;
  const nxR = uRy;
  const nyR = -uRx;

  const rExtTop = hasTopRoad ? ext + roadHeight : ext;
  const rExtBottom = hasBottomRoad ? 0 : ext;

  const rP1 = { x: pTopRight.x - uRx * rExtTop, y: pTopRight.y - uRy * rExtTop };
  const rP2 = { x: pBottomRight.x + uRx * rExtBottom, y: pBottomRight.y + uRy * rExtBottom };
  const rP3 = { x: rP2.x + nxR * roadHeight, y: rP2.y + nyR * roadHeight };
  const rP4 = { x: rP1.x + nxR * roadHeight, y: rP1.y + nyR * roadHeight };

  return (
    <>
      {/* =========================================
          1. BOTTOM ROAD (Clean Block)
          ========================================= */}
      {hasBottomRoad && (
        <>
          <polygon
            points={`
              ${bP1.x},${bP1.y} 
              ${bP2.x},${bP2.y} 
              ${bP3.x},${bP3.y} 
              ${bP4.x},${bP4.y}
            `}
            fill="transparent"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </>
      )}

      {/* =========================================
          2. LEFT SIDE ROAD (Clean T-Junction Meeting)
          ========================================= */}
      {hasLeftRoad && (
        <polygon
          points={`
            ${lP1.x},${lP1.y} 
            ${lP2.x},${lP2.y} 
            ${lP3.x},${lP3.y} 
            ${lP4.x},${lP4.y}
          `}
          fill="transparent"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      )}

      {/* =========================================
          3. RIGHT SIDE ROAD (Clean T-Junction Meeting)
          ========================================= */}
      {hasRightRoad && (
        <polygon
          points={`
            ${rP1.x},${rP1.y} 
            ${rP2.x},${rP2.y} 
            ${rP3.x},${rP3.y} 
            ${rP4.x},${rP4.y}
          `}
          fill="transparent"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      )}

      
      {/* =========================================
          DEBUG / POSITION ANCHOR
          ========================================= */}
      <g data-site-layout-y={siteLayoutY} />
    </>
  );
}

export function getSiteLayoutY(
  plotBottomY: number,
  roadWidth: number = 15
): number {
  const safeRoadWidth =
    Number.isFinite(Number(roadWidth)) &&
    Number(roadWidth) > 0
      ? Number(roadWidth)
      : 15;

  const roadHeight = safeRoadWidth * SCALE;

  return plotBottomY + roadHeight + SITE_LAYOUT_GAP;
}

export function getRoadHeight(roadWidth: number = 15): number {
  const safeRoadWidth =
    Number.isFinite(Number(roadWidth)) &&
    Number(roadWidth) > 0
      ? Number(roadWidth)
      : 15;

  return safeRoadWidth * SCALE;
}