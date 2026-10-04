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

// 🎨 LIGHT THEME COLORS
const BG_FILL = "#ffffff";           // Table background (was #000000)
const HEADER_BG = "#f0f0f0";         // Header background (was #002244)
const LINE_PRIMARY = "#000000";      // Primary line/stroke (was #00aaff)
const LINE_SECONDARY = "#cccccc";    // Row divider lines (was #003366)
const LABEL_TEXT = "#000000";        // Label text (was #ffffff)
const VALUE_TEXT = "#1e40af";        // Value text (was #00aaff)

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
      {/* Table background */}
      <rect
        x="0"
        y="0"
        width={tableTotalWidth}
        height={tableDynamicHeight}
        fill={BG_FILL}
        stroke={LINE_PRIMARY}
        strokeWidth="0.8"
        rx="4"
      />
      
      {/* Header background */}
      <rect
        x="0"
        y="0"
        width={tableTotalWidth}
        height={12 * scale}
        fill={HEADER_BG}
        stroke={LINE_PRIMARY}
        strokeWidth="0.6"
      />
      
      {/* Header text */}
      <text
        x={tableTotalWidth / 2}
        y={7 * scale}
        fill={LINE_PRIMARY}
        fontSize="9"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        STRUCTURAL SPECIFICATIONS & SCHEDULE OF FINISHES
      </text>

      {/* Table rows */}
      {tableItems.map((item, idx) => {
        const rowY = 16 * scale + idx * 8 * scale;
        return (
          <g key={idx}>
            <text x={2 * scale} y={rowY} fill={LABEL_TEXT} fontSize="7.5" fontWeight="bold" dominantBaseline="middle">
              • {item.label}:
            </text>
            <text x={25 * scale} y={rowY} fill={VALUE_TEXT} fontSize="7.5" dominantBaseline="middle">
              {item.val}
            </text>
            <line x1={5 * scale} y1={rowY + 4 * scale} x2={tableTotalWidth - 5 * scale} y2={rowY + 4 * scale} stroke={LINE_SECONDARY} strokeWidth="0.4" />
          </g>
        );
      })}
    </g>
  );
}