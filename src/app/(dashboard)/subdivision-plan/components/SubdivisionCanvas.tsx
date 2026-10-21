"use client";

import React, { useMemo } from "react";
import PlotPolygonRenderer from "../../construction-plan/components/PlotPolygonRenderer";
import BoundaryLabels from "../../construction-plan/components/BoundaryLabels";
import RoadRenderer from "../../construction-plan/components/RoadRenderer";
import { PlotDimensions } from "../../construction-plan/engine/planningTypes";
import type { PieceInfo, Pt } from "../subdivisionTypes";

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

// 🎨 Piece fill colors (rotation for multiple plots)
const PIECE_PALETTE = [
  "rgba(59, 130, 246, 0.20)",   // blue
  "rgba(16, 185, 129, 0.20)",   // green
  "rgba(245, 158, 11, 0.20)",   // amber
  "rgba(236, 72, 153, 0.20)",   // pink
  "rgba(139, 92, 246, 0.20)",   // purple
  "rgba(249, 115, 22, 0.20)",   // orange
  "rgba(6, 182, 212, 0.20)",    // cyan
  "rgba(148, 163, 184, 0.20)",  // slate
];

const PIECE_STROKE = [
  "#1e40af",
  "#047857",
  "#b45309",
  "#be185d",
  "#6d28d9",
  "#c2410c",
  "#0e7490",
  "#475569",
];

const REMAINDER_FILL = "rgba(148, 163, 184, 0.15)";
const REMAINDER_STROKE = "#64748b";

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

  // ✅ Piece polygons ko world coords me map karo
  const piecePolys = useMemo(() => {
    return pieces.map((pc, idx) => {
      // Subdivision engine ke coords (0,0) = plot ka top-left
      // World me plot ka top-left = pTopLeft
      const ox = pTopLeft.x;
      const oy = pTopLeft.y;
      return {
        ...pc,
        idx,
        worldPoly: pc.polygon.map((p) => ({
          x: ox + p.x * scale,
          y: oy + p.y * scale,
        })),
      };
    });
  }, [pieces, pTopLeft.x, pTopLeft.y, scale]);

  const fmtDim = (v: number) => {
    if (measurementUnit === "METERS") return `${v.toFixed(2)}m`;
    const totalInches = Math.round(v * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'-${inches}"`;
  };

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

      {/* 2. Subdivision pieces (SAARE tukde) */}
      {piecePolys.map((pc) => {
        const isSel = pc.id === selectedPieceId;
        const isPlot = pc.kind === "PLOT";
        const fill = isPlot
          ? PIECE_PALETTE[(pc.number - 1) % PIECE_PALETTE.length]
          : REMAINDER_FILL;
        const stroke = isSel
          ? "#dc2626"
          : isPlot
          ? PIECE_STROKE[(pc.number - 1) % PIECE_STROKE.length]
          : REMAINDER_STROKE;

        const pts = pc.worldPoly.map((p) => `${p.x},${p.y}`).join(" ");

        // Centroid (label position)
        const cx =
          pc.worldPoly.reduce((s, p) => s + p.x, 0) / pc.worldPoly.length;
        const cy =
          pc.worldPoly.reduce((s, p) => s + p.y, 0) / pc.worldPoly.length;

        // Dimension text (fit ya nahi)
        const bboxW = pc.bbox.w;
        const bboxH = pc.bbox.h;
        const dimText = pc.isRect
          ? `${fmtDim(bboxW)} × ${fmtDim(bboxH)}`
          : `${fmtDim(bboxW)} × ${fmtDim(bboxH)} (IRR)`;

        const areaText = `${pc.area.toFixed(0)} SQ.FT`;

        return (
          <g
            key={pc.id}
            onClick={() => onPieceClick?.(pc.id)}
            style={{ cursor: onPieceClick ? "pointer" : "default" }}
          >
            {/* Piece polygon */}
            <polygon
              points={pts}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSel ? 2.5 : 1.2}
              strokeDasharray={!isPlot ? "5 3" : "0"}
              strokeLinejoin="round"
            />

            {/* Piece number badge (top-left corner of centroid) */}
            <circle
              cx={cx}
              cy={cy - 14}
              r={5}
              fill={isPlot ? stroke : REMAINDER_STROKE}
              stroke="#ffffff"
              strokeWidth={0.8}
            />
            <text
              x={cx}
              y={cy - 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize="5.5"
              fontWeight="900"
              pointerEvents="none"
            >
              {pc.number}
            </text>

            {/* Piece label (PLOT 1 / OPEN 1) */}
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#0f172a"
              fontSize="7"
              fontWeight="900"
              pointerEvents="none"
              style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "2px" }}
            >
              {pc.label}
            </text>

            {/* Piece dimensions */}
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#1e40af"
              fontSize="5.5"
              fontWeight="700"
              pointerEvents="none"
              style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "1.5px" }}
            >
              {dimText}
            </text>

            {/* Piece area */}
            <text
              x={cx}
              y={cy + 16}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#475569"
              fontSize="5"
              fontWeight="700"
              pointerEvents="none"
              style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "1.5px" }}
            >
              {areaText}
            </text>
          </g>
        );
      })}

      {/* 3. Dimension chain (plot ke bahar) */}
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

      {/* 4. Roads + Compass */}
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

      {/* 5. Title (center of plot) */}
      <text
        x={centerX}
        y={centerY - 20}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#0f172a"
        fontSize="9"
        fontWeight="900"
        pointerEvents="none"
        style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "3px" }}
      >
        SUBDIVISION LAYOUT
      </text>

      {/* 6. Piece count summary (bottom-right) */}
      {pieces.length > 0 && (
        <g transform={`translate(${maxX - 130}, ${maxY + 40})`}>
          <rect
            x="0"
            y="0"
            width="120"
            height="28"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="0.8"
            rx="3"
          />
          <text
            x="60"
            y="9"
            textAnchor="middle"
            fill="#0f172a"
            fontSize="6"
            fontWeight="900"
          >
            TOTAL: {pieces.length} PIECES
          </text>
          <text
            x="60"
            y="20"
            textAnchor="middle"
            fill="#1e40af"
            fontSize="6"
            fontWeight="900"
          >
            {pieces.filter((p) => p.kind === "PLOT").length} PLOT ·{" "}
            {pieces.filter((p) => p.kind === "REMAINDER").length} OPEN
          </text>
        </g>
      )}
    </g>
  );
}