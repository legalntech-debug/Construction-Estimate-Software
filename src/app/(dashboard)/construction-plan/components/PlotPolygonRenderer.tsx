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
  const hatchSpacing = 8 * cadZoom;

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
            stroke="black"
            strokeWidth={1 * cadZoom}
            opacity="0.4"
          />
        </pattern>
      </defs>

      {/* Main Plot Polygon (Bright Solid Yellow/Gold Border) */}
      {plotPoints && (
        <polygon
          points={plotPoints}
          fill="none"
          stroke="#E6B800" 
          strokeWidth={isSelected ? Math.max(3, 5 * cadZoom) : Math.max(2, 3.5 * cadZoom)}
          className="cursor-pointer transition-all"
          onClick={(e) => handlePolygonClick(e, "plot")}
        />
      )}

      {/* Proposed Site Polygon (With Hatching inside) */}
      {proposedPoints && (
        <polygon
          points={proposedPoints}
          fill={`url(#${hatchId})`}
          stroke="#333333"
          strokeWidth={1.5 * cadZoom}
          strokeDasharray="4 4"
          className="cursor-pointer transition-all"
          onClick={(e) => handlePolygonClick(e, "proposed")}
        />
      )}
    </g>
  );
}