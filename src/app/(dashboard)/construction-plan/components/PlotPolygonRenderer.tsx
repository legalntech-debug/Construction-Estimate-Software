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
            stroke="#ffffff"
            strokeWidth={0.8 * (cadZoom || 1)}
            opacity="0.25"
          />
        </pattern>
      </defs>

      {/* Main Plot Polygon (Engineering Thin Sharp Border) */}
      {plotPoints && (
        <polygon
          points={plotPoints}
          fill="rgba(255, 255, 255, 0.02)" 
          stroke="#E6B800" 
          strokeWidth={isSelected ? 1.8 : 1.2} /* <-- Yahan stroke width ko thin kar diya gaya hai */
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
          stroke="#00ffff"
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