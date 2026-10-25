"use client";

import React from "react";
import PlotPolygonRenderer from "../../construction-plan/components/PlotPolygonRenderer";
import BoundaryLabels from "../../construction-plan/components/BoundaryLabels";
import RoadRenderer from "../../construction-plan/components/RoadRenderer";
import { PlotDimensions } from "../../construction-plan/engine/planningTypes";
import type { PieceInfo } from "../subdivisionTypes";
import EngineeringPieces from "./EngineeringPieces";

interface SubdivisionCanvasProps {
  plotDimensions: PlotDimensions;
  roadFacingOption: string;
  boundaries: { north: string; south: string; east: string; west: string };
  measurementUnit: "FEET" | "METERS";
  roadWidthNorth?: number;
  roadWidthSouth?: number;
  roadWidthEast?: number;
  roadWidthWest?: number;
  pieces?: PieceInfo[];
  selectedPieceId?: string | null;
  onPieceClick?: (id: string) => void;
  scale?: number;
}

/* =========================================================
   SUBDIVISION CANVAS — engineering-style drawing
   Plot outline, boundary dimension chain, roads and compass come
   from the construction-plan renderers. The subdivision pieces are
   drawn by <EngineeringPieces />: black line work, hatched open
   land / roads, dimension lines and an area on every plot.
========================================================= */
export default function SubdivisionCanvas({
  plotDimensions,
  roadFacingOption,
  boundaries,
  measurementUnit,
  roadWidthNorth = 15,
  roadWidthSouth = 15,
  roadWidthEast = 15,
  roadWidthWest = 15,
  pieces = [],
  selectedPieceId = null,
  onPieceClick,
  scale = 5.5,
}: SubdivisionCanvasProps) {
  const dimA = Number(plotDimensions.A) || 20;
  const dimB = Number(plotDimensions.B) || dimA;
  const dimC = Number(plotDimensions.C) || 50;
  const dimD = Number(plotDimensions.D) || dimC;

  const bottomWidth = dimA * scale;
  const topWidth = dimB * scale;
  const heightLeft = dimC * scale;
  const heightRight = dimD * scale;

  const pBottomLeft = { x: -bottomWidth / 2, y: heightLeft / 2 };
  const pBottomRight = { x: bottomWidth / 2, y: heightLeft / 2 };
  const pTopLeft = { x: -topWidth / 2, y: -heightLeft / 2 };
  const pTopRight = { x: topWidth / 2, y: -heightRight / 2 };

  const correctedPoints = [pTopLeft, pTopRight, pBottomRight, pBottomLeft];

  const xs = correctedPoints.map((p) => p.x);
  const ys = correctedPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const roadOptUpper = (roadFacingOption || "").toUpperCase();
  const activeNorth = roadOptUpper.includes("NORTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("CORNER");
  const activeSouth = roadOptUpper.includes("SOUTH") || roadOptUpper.includes("ALL");
  const activeEast = roadOptUpper.includes("EAST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("CORNER");
  const activeWest = roadOptUpper.includes("WEST") || roadOptUpper.includes("ALL");

  const plotCount = pieces.filter((p) => p.kind === "PLOT").length;
  const openCount = pieces.length - plotCount;

  return (
    <g>
      {/* 1. Plot outline */}
      <PlotPolygonRenderer
        plotPolygon={correctedPoints}
        proposedSitePolygon={[]}
        cadZoom={1}
        isSelected={false}
        handlePolygonClick={() => {}}
      />

      {/* 2. Subdivision pieces */}
      <EngineeringPieces
        pieces={pieces}
        ox={pTopLeft.x}
        oy={pTopLeft.y}
        scale={scale}
        unit={measurementUnit}
        selectedPieceId={selectedPieceId}
        onPieceClick={onPieceClick}
        idPrefix="sdv-main"
      />

      {/* 3. Dimension chain (outside the plot) */}
      <BoundaryLabels
        topBoundary={boundaries.north}
        bottomBoundary={boundaries.south}
        leftBoundary={boundaries.west}
        rightBoundary={boundaries.east}
        dimA={dimA}
        dimB={dimB}
        dimC={dimC}
        dimD={dimD}
        pTopLeft={pTopLeft}
        pTopRight={pTopRight}
        pBottomLeft={pBottomLeft}
        pBottomRight={pBottomRight}
        centerX={centerX}
        centerY={centerY}
        minX={minX}
        maxX={maxX}
        roadFacingOption={roadFacingOption}
        roadWidth={activeSouth ? roadWidthSouth : roadWidthNorth}
        measurementUnit={measurementUnit}
      />

      {/* 4. Roads + compass */}
      <RoadRenderer
        roadFacingOption={roadFacingOption}
        bottomBoundary={boundaries.south}
        topBoundary={boundaries.north}
        boundaryEast={boundaries.east}
        boundaryWest={boundaries.west}
        pTopLeft={pTopLeft}
        pTopRight={pTopRight}
        pBottomLeft={pBottomLeft}
        pBottomRight={pBottomRight}
        roadWidthNorth={activeNorth ? roadWidthNorth : 0}
        roadWidthSouth={activeSouth ? roadWidthSouth : 0}
        roadWidthEast={activeEast ? roadWidthEast : 0}
        roadWidthWest={activeWest ? roadWidthWest : 0}
      />

      {/* 5. Drawing title (top-left corner of the sheet, clear of roads and dimension chains) */}
      <g fontFamily="Arial, Helvetica, sans-serif" pointerEvents="none">
        <text x={-480} y={-372} fontSize={11} fontWeight={900} fill="#000000">
          SUBDIVISION LAYOUT
        </text>
        <line x1={-480} y1={-366} x2={-330} y2={-366} stroke="#000000" strokeWidth={1.2} />
        <text x={-480} y={-354} fontSize={7} fontWeight={700} fill="#000000">
          SCALE: N.T.S.
        </text>
      </g>

      {/* 6. Piece count summary (bottom-right) */}
      {pieces.length > 0 && (
        <g transform={`translate(${maxX - 130}, ${maxY + 40})`} fontFamily="Arial, Helvetica, sans-serif">
          <rect x="0" y="0" width="120" height="28" fill="#ffffff" stroke="#000000" strokeWidth="0.8" />
          <text x="60" y="11" textAnchor="middle" fill="#000000" fontSize="6.5" fontWeight="900">
            TOTAL: {pieces.length} PIECES
          </text>
          <text x="60" y="21" textAnchor="middle" fill="#000000" fontSize="6" fontWeight="700">
            {plotCount} PLOT · {openCount} OPEN / ROAD
          </text>
        </g>
      )}
    </g>
  );
}
