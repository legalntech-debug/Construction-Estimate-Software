/* =========================================================
CONSTRUCTION PLAN SYSTEM — VASTU RULES ENGINE
---------------------------------------------------------
Evaluates room placements against traditional Vastu directions
and returns soft compliance assessments.
========================================================= */

import { VastuAssessment, VastuDirection } from "./types";

export function assessVastuForRoom(
  roomKey: string,
  assignedZone: VastuDirection
): VastuAssessment {
  switch (roomKey) {
    case "POOJA ROOM":
      if (assignedZone === "NE") {
        return { zone: assignedZone, status: "GOOD", note: "Ideal North-East zone for spiritual harmony." };
      }
      return { zone: assignedZone, status: "ALTERNATIVE ZONE", note: "North-East is preferred for Pooja." };

    case "KITCHEN":
      if (assignedZone === "SE" || assignedZone === "NW") {
        return { zone: assignedZone, status: "GOOD", note: "South-East (Agneya) or North-West are ideal for fire elements." };
      }
      return { zone: assignedZone, status: "ALTERNATIVE ZONE", note: "SE or NW are standard preferred zones for Kitchen." };

    case "MASTER BEDROOM":
      if (assignedZone === "SW") {
        return { zone: assignedZone, status: "GOOD", note: "South-West is ideal for the head of the family." };
      }
      return { zone: assignedZone, status: "ALTERNATIVE ZONE", note: "South-West is traditionally preferred for Master Bedroom." };

    case "STAIRCASE":
      if (assignedZone === "SOUTH" || assignedZone === "WEST" || assignedZone === "SW") {
        return { zone: assignedZone, status: "GOOD", note: "Heavy zones (South, West, South-West) are optimal for stairs." };
      }
      return { zone: assignedZone, status: "ALTERNATIVE ZONE", note: "Southern or Western quadrants preferred for staircases." };

    default:
      return { zone: assignedZone, status: "GOOD", note: "Placement aligns within acceptable parameters." };
  }
}