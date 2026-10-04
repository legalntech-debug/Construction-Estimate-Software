import React from "react";

interface PlotPolygonRendererProps {
  plotPolygon: { x: number; y: number }[] | null;
  proposedSitePolygon: { x: number; y: number }[] | null;
  cadZoom: number;
  isSelected: boolean;
  handlePolygonClick: (
    e: React.MouseEvent<SVGPolygonElement>,
    type: "plot" | "proposed"
  ) => void;
}

// 🎨 LIGHT THEME COLORS
const PLOT_STROKE = "#000000";        // Plot border (was #E6B800 yellow)
const HATCH_STROKE = "#666666";       // Hatch lines (was #ffffff)
const PROPOSED_STROKE = "#1e40af";    // Proposed site border (was #00ffff cyan)

export default function PlotPolygonRenderer({
  plotPolygon,
  proposedSitePolygon,
  cadZoom,
  isSelected,
  handlePolygonClick,
}: PlotPolygonRendererProps) {
  const plotPoints = plotPolygon
    ?.map((p) => `${p.x},${p.y}`)
    .join(" ");
  const proposedPoints = proposedSitePolygon
    ?.map((p) => `${p.x},${p.y}`)
    .join(" ");

  const hatchId = "diagonalHatch";
  const hatchSpacing = 8 * (cadZoom || 1);

  return (
    <g>
      <defs>
        <pattern
          id={hatchId}
          patternUnits="userSpaceOnUse"
          width={hatchSpacing}
          height={hatchSpacing}
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={hatchSpacing}
            stroke={HATCH_STROKE}
            strokeWidth={0.8 * (cadZoom || 1)}
            opacity="0.4"
          />
        </pattern>
      </defs>

      {/* Main Plot Polygon */}
      {plotPoints && (
        <polygon
          points={plotPoints}
          fill="none" 
          stroke={PLOT_STROKE} 
          strokeWidth={isSelected ? 2.5 : 1.5}
          strokeLinejoin="round"
          className="cursor-pointer transition-all"
          onClick={(e) => handlePolygonClick(e, "plot")}
        />
      )}

      {/* Proposed Site Polygon */}
      {proposedPoints && (
        <polygon
          points={proposedPoints}
          fill={`url(#${hatchId})`}
          stroke={PROPOSED_STROKE}
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeLinejoin="round"
          className="cursor-pointer transition-all"
          onClick={(e) => handlePolygonClick(e, "proposed")}
        />
      )}
    </g>
  );
}