import React from "react";

interface CadStructuralTableProps {
  tableTotalWidth: number;
  tableDynamicHeight: number;
  tableItems: { label: string; val: string }[];
  scale: number;
  elevationStartX: number;
  elevationRowStartY: number;
  MANUAL_TABLE_X_OFFSET: number;
  MANUAL_TABLE_Y_OFFSET: number;
}

export default function CadStructuralTable({
  tableTotalWidth,
  tableDynamicHeight,
  tableItems,
  scale,
  elevationStartX,
  elevationRowStartY,
  MANUAL_TABLE_X_OFFSET,
  MANUAL_TABLE_Y_OFFSET,
}: CadStructuralTableProps) {
  return (
    <g transform={`translate(${elevationStartX + MANUAL_TABLE_X_OFFSET}, ${elevationRowStartY + MANUAL_TABLE_Y_OFFSET})`}>
      <rect
        x="0"
        y="0"
        width={tableTotalWidth}
        height={tableDynamicHeight}
        fill="#000000"
        fillOpacity="0.95"
        stroke="#00aaff"
        strokeWidth="0.8"
        rx="4"
      />
      <rect
        x="0"
        y="0"
        width={tableTotalWidth}
        height={12 * scale}
        fill="#002244"
        stroke="#00aaff"
        strokeWidth="0.6"
      />
      <text
        x={tableTotalWidth / 2}
        y={7 * scale}
        fill="#00aaff"
        fontSize="9"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        STRUCTURAL SPECIFICATIONS & SCHEDULE OF FINISHES
      </text>

      {tableItems.map((item, idx) => {
        const rowY = 16 * scale + idx * 8 * scale;
        return (
          <g key={idx}>
            <text x={2 * scale} y={rowY} fill="#ffffff" fontSize="7.5" fontWeight="bold" dominantBaseline="middle">
              • {item.label}:
            </text>
            <text x={25 * scale} y={rowY} fill="#00aaff" fontSize="7.5" dominantBaseline="middle">
              {item.val}
            </text>
            <line x1={5 * scale} y1={rowY + 4 * scale} x2={tableTotalWidth - 5 * scale} y2={rowY + 4 * scale} stroke="#003366" strokeWidth="0.4" />
          </g>
        );
      })}
    </g>
  );
}