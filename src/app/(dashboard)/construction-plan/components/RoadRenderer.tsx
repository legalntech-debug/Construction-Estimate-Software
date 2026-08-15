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

  /*
   * IMPORTANT:
   * 1 ft road width = SCALE pixels
   *
   * Example:
   * 15 ft = 82.5 px
   * 20 ft = 110 px
   * 23 ft = 126.5 px
   * 30 ft = 165 px
   */
  const safeRoadWidth =
    Number.isFinite(Number(roadWidth)) && Number(roadWidth) > 0
      ? Number(roadWidth)
      : 15;

  const roadHeight = safeRoadWidth * SCALE;
  const ext = 120;

  /*
   * SITE LAYOUT ki Y position.
   * Isko parent component bhi use kar sakta hai.
   */
  const siteLayoutY = pBottomLeft.y + roadHeight + SITE_LAYOUT_GAP;

  const isFourSide = opt.includes("4 SIDE");
  const isThreeSide = opt.includes("3 SIDE");
  const isTwoSide =
    opt.includes("2 SIDE") ||
    opt.includes("FRONT & REAR");

  const allDirs = [
    "NORTH",
    "SOUTH",
    "EAST",
    "WEST",
  ];

  const foundDirs: {
    dir: string;
    index: number;
  }[] = [];

  allDirs.forEach((dir) => {
    const idx = opt.indexOf(dir);

    if (idx !== -1) {
      foundDirs.push({
        dir,
        index: idx,
      });
    }
  });

  foundDirs.sort((a, b) => a.index - b.index);

  /*
   * First selected direction = MAIN ROAD
   */
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
    {
      top: string;
      left: string;
      right: string;
    }
  > = {
    NORTH: {
      top: "SOUTH",
      left: "WEST",
      right: "EAST",
    },

    SOUTH: {
      top: "NORTH",
      left: "EAST",
      right: "WEST",
    },

    EAST: {
      top: "WEST",
      left: "SOUTH",
      right: "NORTH",
    },

    WEST: {
      top: "EAST",
      left: "NORTH",
      right: "SOUTH",
    },
  };

  const currentCompass =
    compassMap[mainRoad] ||
    compassMap["SOUTH"];

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

  const bottomExtLeft = ext;
  const bottomExtRight = ext;

  // Calculate direction vector and normal vector for bottom tilted road alignment
  const dx = pBottomRight.x - pBottomLeft.x;
  const dy = pBottomRight.y - pBottomLeft.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; 
  const ny = dx / len;  

  const extLeftP1 = { 
    x: pBottomLeft.x - (dx / len) * bottomExtLeft, 
    y: pBottomLeft.y - (dy / len) * bottomExtLeft 
  };
  const extRightP1 = { 
    x: pBottomRight.x + (dx / len) * bottomExtRight, 
    y: pBottomRight.y + (dy / len) * bottomExtRight 
  };
  
  const extLeftP2 = { x: extLeftP1.x + nx * roadHeight, y: extLeftP1.y + ny * roadHeight };
  const extRightP2 = { x: extRightP1.x + nx * roadHeight, y: extRightP1.y + ny * roadHeight };

  const topExtLeft = ext;
  const topExtRight = ext;

  const rwTop =
    pTopRight.x -
    pTopLeft.x +
    topExtLeft +
    topExtRight;

  const rxTop =
    pTopLeft.x -
    topExtLeft;

  const rhVertical =
    pBottomRight.y -
    pTopRight.y;

  const ryVertical =
    pTopRight.y;

  return (
    <>
      {/* =========================================
          1. BOTTOM ROAD (Tilted Dynamic Support)
          ========================================= */}
      {hasBottomRoad && (
        <g>
          <polygon
            points={`
              ${extLeftP1.x},${extLeftP1.y} 
              ${extRightP1.x},${extRightP1.y} 
              ${extRightP2.x},${extRightP2.y} 
              ${extLeftP2.x},${extLeftP2.y}
            `}
            fill="rgba(255,255,255,0.02)"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {hasLeftRoad && (
            <line
              x1={pBottomLeft.x}
              y1={pBottomLeft.y}
              x2={extLeftP2.x}
              y2={extLeftP2.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}

          {hasRightRoad && (
            <line
              x1={pBottomRight.x}
              y1={pBottomRight.y}
              x2={extRightP2.x}
              y2={extRightP2.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}
        </g>
      )}

      {/* =========================================
          2. TOP ROAD
          ========================================= */}
      {hasTopRoad && (
        <g>
          <rect
            x={rxTop}
            y={pTopLeft.y - roadHeight}
            width={rwTop}
            height={roadHeight}
            fill="rgba(255,255,255,0.02)"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {hasLeftRoad ? (
            <line
              x1={pTopLeft.x}
              y1={pTopLeft.y}
              x2={pTopLeft.x - roadHeight}
              y2={pTopLeft.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          ) : (
            <line
              x1={pTopLeft.x}
              y1={pTopLeft.y - roadHeight}
              x2={pTopLeft.x}
              y2={pTopLeft.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}

          {hasRightRoad ? (
            <line
              x1={pTopRight.x}
              y1={pTopRight.y}
              x2={pTopRight.x + roadHeight}
              y2={pTopRight.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          ) : (
            <line
              x1={pTopRight.x}
              y1={pTopRight.y - roadHeight}
              x2={pTopRight.x}
              y2={pTopRight.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}
        </g>
      )}

      {/* =========================================
          3. RIGHT SIDE ROAD
          ========================================= */}
      {hasRightRoad && (
        <g>
          <rect
            x={pBottomRight.x}
            y={ryVertical}
            width={roadHeight}
            height={rhVertical}
            fill="rgba(255,255,255,0.02)"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {hasBottomRoad && (
            <line
              x1={pBottomRight.x}
              y1={pBottomLeft.y}
              x2={pBottomRight.x + roadHeight}
              y2={pBottomLeft.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}

          {hasTopRoad && (
            <line
              x1={pBottomRight.x}
              y1={pTopRight.y}
              x2={pBottomRight.x + roadHeight}
              y2={pTopRight.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}
        </g>
      )}

      {/* =========================================
          4. LEFT SIDE ROAD
          ========================================= */}
      {hasLeftRoad && (
        <g>
          <rect
            x={pBottomLeft.x - roadHeight}
            y={ryVertical}
            height={rhVertical}
            width={roadHeight}
            fill="rgba(255,255,255,0.02)"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {hasBottomRoad && (
            <line
              x1={pBottomLeft.x - roadHeight}
              y1={pBottomLeft.y}
              x2={pBottomLeft.x}
              y2={pBottomLeft.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}

          {hasTopRoad && (
            <line
              x1={pBottomLeft.x - roadHeight}
              y1={pTopLeft.y}
              x2={pBottomLeft.x}
              y2={pTopLeft.y}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}
        </g>
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

  return (
    plotBottomY +
    roadHeight +
    SITE_LAYOUT_GAP
  );
}

export function getRoadHeight(
  roadWidth: number = 15
): number {
  const safeRoadWidth =
    Number.isFinite(Number(roadWidth)) &&
    Number(roadWidth) > 0
      ? Number(roadWidth)
      : 15;

  return safeRoadWidth * SCALE;
}