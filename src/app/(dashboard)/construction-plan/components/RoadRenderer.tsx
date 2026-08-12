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
}

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
}: RoadRendererProps) {
  const opt = roadFacingOption.toUpperCase();
  const roadHeight = 80;
  const ext = 120; // 6'-6" extension representation

  const isFourSide = opt.includes("4 SIDE");
  const isThreeSide = opt.includes("3 SIDE");
  const isTwoSide = opt.includes("2 SIDE") || opt.includes("FRONT & REAR");

  // --- EXACT SEQUENCE PARSING ---
  const allDirs = ["NORTH", "SOUTH", "EAST", "WEST"];
  const foundDirs: { dir: string; index: number }[] = [];

  allDirs.forEach((dir) => {
    const idx = opt.indexOf(dir);
    if (idx !== -1) {
      foundDirs.push({ dir, index: idx });
    }
  });

  foundDirs.sort((a, b) => a.index - b.index);

  let mainRoad = "SOUTH"; // Default
  let secondRoad = "";

  if (foundDirs.length > 0) {
    mainRoad = foundDirs[0].dir; // Pehli direction hamesha Bottom (Main Road) hogi
  }
  if (foundDirs.length > 1) {
    secondRoad = foundDirs[1].dir; // Dusri direction Corner/Second Road hogi
  }

  // Compass Mapping relative to Main Road at Bottom:
  const compassMap: Record<string, { top: string; left: string; right: string }> = {
    NORTH: { top: "SOUTH", left: "WEST", right: "EAST" },
    SOUTH: { top: "NORTH", left: "EAST", right: "WEST" },
    EAST:  { top: "WEST",  left: "SOUTH", right: "NORTH" },
    WEST:  { top: "EAST",  left: "NORTH", right: "SOUTH" },
  };

  const currentCompass = compassMap[mainRoad] || compassMap["SOUTH"];

  let hasBottomRoad = true; // Main road hamesha bottom mein
  
  // Agar 2-Side Front & Rear hai ya opposite roads hain (jaise North & South), toh top road active hogi
  let hasTopRoad = isFourSide || isThreeSide || isTwoSide || secondRoad === currentCompass.top;
  
  // Left aur Right sirf tabhi active honge jab woh adjacent (90-degree) corner roads hon
  let hasRightRoad = isFourSide || isThreeSide || secondRoad === currentCompass.right;
  let hasLeftRoad = isFourSide || isThreeSide || secondRoad === currentCompass.left;

  // --- EXTENSIONS ---
  const bottomExtLeft = ext;
  const bottomExtRight = ext;
  const topExtLeft = ext;
  const topExtRight = ext;

  const rwBottom = (pBottomRight.x - pBottomLeft.x) + bottomExtLeft + bottomExtRight;
  const rxBottom = pBottomLeft.x - bottomExtLeft;

  const rhVertical = pBottomRight.y - pTopRight.y;
  const ryVertical = pTopRight.y;

  const rwTop = (pTopRight.x - pTopLeft.x) + topExtLeft + topExtRight;
  const rxTop = pTopLeft.x - topExtLeft;

  return (
    <>
      {/* 1. BOTTOM ROAD (Always Main Road) */}
      {hasBottomRoad && (
        <g>
          <rect x={rxBottom} y={pBottomLeft.y} width={rwBottom} height={roadHeight} fill="none" stroke="black" strokeWidth="2" />
          {hasLeftRoad && (
            <line x1={pBottomLeft.x} y1={pBottomLeft.y} x2={pBottomLeft.x - roadHeight} y2={pBottomLeft.y} stroke="white" strokeWidth="3" />
          )}
          {hasRightRoad && (
            <line x1={pBottomRight.x} y1={pBottomRight.y} x2={pBottomRight.x + roadHeight} y2={pBottomRight.y} stroke="white" strokeWidth="3" />
          )}
        </g>
      )}

      {/* 2. TOP ROAD */}
      {hasTopRoad && (
        <g>
          <rect x={rxTop} y={pTopLeft.y - roadHeight} width={rwTop} height={roadHeight} fill="none" stroke="black" strokeWidth="2" />
          {hasLeftRoad ? (
            <line x1={pTopLeft.x} y1={pTopLeft.y} x2={pTopLeft.x - roadHeight} y2={pTopLeft.y} stroke="white" strokeWidth="3" />
          ) : (
            <line x1={pTopLeft.x} y1={pTopLeft.y - roadHeight} x2={pTopLeft.x} y2={pTopLeft.y} stroke="black" strokeWidth="2" />
          )}
          {hasRightRoad ? (
            <line x1={pTopRight.x} y1={pTopRight.y} x2={pTopRight.x + roadHeight} y2={pTopRight.y} stroke="white" strokeWidth="3" />
          ) : (
            <line x1={pTopRight.x} y1={pTopRight.y - roadHeight} x2={pTopRight.x} y2={pTopRight.y} stroke="black" strokeWidth="2" />
          )}
        </g>
      )}

      {/* 3. RIGHT SIDE ROAD */}
      {hasRightRoad && (
        <g>
          <rect x={pBottomRight.x} y={ryVertical} width={roadHeight} height={rhVertical} fill="none" stroke="black" strokeWidth="2" />
          {hasBottomRoad && (
            <line x1={pBottomRight.x} y1={pBottomLeft.y} x2={pBottomRight.x + roadHeight} y2={pBottomLeft.y} stroke="white" strokeWidth="3" />
          )}
          {hasTopRoad && (
            <line x1={pBottomRight.x} y1={pTopRight.y} x2={pBottomRight.x + roadHeight} y2={pTopRight.y} stroke="white" strokeWidth="3" />
          )}
        </g>
      )}

      {/* 4. LEFT SIDE ROAD */}
      {hasLeftRoad && (
        <g>
          <rect x={pBottomLeft.x - roadHeight} y={ryVertical} height={rhVertical} width={roadHeight} fill="none" stroke="black" strokeWidth="2" />
          {hasBottomRoad && (
            <line x1={pBottomLeft.x - roadHeight} y1={pBottomLeft.y} x2={pBottomLeft.x} y2={pBottomLeft.y} stroke="white" strokeWidth="3" />
          )}
          {hasTopRoad && (
            <line x1={pBottomLeft.x - roadHeight} y1={pTopLeft.y} x2={pBottomLeft.x} y2={pTopLeft.y} stroke="white" strokeWidth="3" />
          )}
        </g>
      )}
    </>
  );
}