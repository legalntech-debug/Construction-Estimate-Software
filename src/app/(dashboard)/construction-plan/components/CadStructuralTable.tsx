import React from "react";

// STRUCTURAL SPECIFICATIONS & SCHEDULE OF FINISHES table ab drawing me nahi dikhegi (CAD + Preview + Print sab jagah).
// Props purane rakhe hain taaki CadFloorElevationRenderer ka import/usage na toote.
interface CadStructuralTableProps {
  tableTotalWidth?: number;
  tableDynamicHeight?: number;
  tableItems?: { label: string; val: string }[];
  scale?: number;
  elevationStartX?: number;
  elevationRowStartY?: number;
  MANUAL_TABLE_X_OFFSET?: number;
  MANUAL_TABLE_Y_OFFSET?: number;
}

export default function CadStructuralTable(_props: CadStructuralTableProps) {
  return null;
}
