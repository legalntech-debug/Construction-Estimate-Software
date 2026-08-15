import React from "react";

// Point2D interface defined locally to avoid missing module errors
export interface Point2D {
  x: number;
  y: number;
}

interface PolygonDimensionOverlayProps {
  points: Point2D[];
  scale: number;
  roadFacingOption: string;
  lShape?: boolean;
  showFooter?: boolean;
}

function distance(a: Point2D, b: Point2D) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function PolygonDimensionOverlay({
  points,
  scale,
  roadFacingOption,
  lShape = false,
  showFooter = true,
}: PolygonDimensionOverlayProps) {
  if (points.length < 3) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const signedArea = points.reduce((sum, p, i) => {
    const n = points[(i + 1) % points.length];
    return sum + p.x * n.y - n.x * p.y;
  }, 0);
  const center = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };

  return (
    <g fontFamily="sans-serif" fill="#ffffff">
      {points.map((a, index) => {
        const b = points[(index + 1) % points.length];
        const lengthFeet = distance(a, b) / scale;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (!len) return null;

        let nx = signedArea > 0 ? dy / len : -dy / len;
        let ny = signedArea > 0 ? -dx / len : dx / len;

        const offset = lShape ? 34 : 28;
        const tx = mx + nx * offset;
        const ty = my + ny * offset;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle > 90 || angle < -90) angle += 180;

        return (
          <g key={`dim-${index}`}>
            <line
              x1={a.x + nx * 12}
              y1={a.y + ny * 12}
              x2={b.x + nx * 12}
              y2={b.y + ny * 12}
              stroke="#ffffff"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
            {/* Background rect removed, text color set to white */}
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize="12"
              fontWeight="900"
              transform={`rotate(${angle}, ${tx}, ${ty})`}
            >
              {lengthFeet.toFixed(2).replace(/\.00$/, "")}&apos;
            </text>
          </g>
        );
      })}

      {showFooter && (
        <g transform={`translate(${center.x}, ${Math.max(...ys) + 86})`}>
          <rect
            x="-145"
            y="-16"
            width="290"
            height="32"
            fill="#121212"
            stroke="#ffffff"
            strokeWidth="1"
          />
          <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="11" fontWeight="900">
            {lShape ? "L-SHAPE — EDIT A/C/E/F DIMENSIONS" : `ROAD / FRONT: ${roadFacingOption}`.toUpperCase()}
          </text>
        </g>
      )}
    </g>
  );
}