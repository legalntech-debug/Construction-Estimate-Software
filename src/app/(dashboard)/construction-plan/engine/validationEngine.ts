/* =========================================================
   CONSTRUCTION PLAN SYSTEM — ARCHITECTURAL VALIDATION ENGINE
   Checks geometry, room fit, access/connectivity, parking-to-entry,
   staircase landing/access, ventilation/duct usage and labels.
========================================================= */

import { FloorData, FloorRoom, PlacedDoor, PlacedWindow } from "./planningTypes";

export type RenderedRoomBox = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  doors?: PlacedDoor[];
  windows?: PlacedWindow[];
};

export type ValidationError = {
  floor: string;
  roomKey?: string;
  severity: "ERROR" | "WARNING";
  message: string;
};

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
};

const EPS = 0.15; // Flexible tolerance for alignment

export const NBC_ROOM_SPECS: Record<string, { minW: number; minH: number; maxRatio: number }> = {
  bedroom: { minW: 8.5, minH: 9.0, maxRatio: 2.5 },
  "master-bedroom": { minW: 10.5, minH: 10.5, maxRatio: 2.5 },
  kitchen: { minW: 5.5, minH: 6.5, maxRatio: 2.5 },
  "kitchen-dining": { minW: 8.0, minH: 9.5, maxRatio: 2.8 },
  dining: { minW: 6.5, minH: 6.5, maxRatio: 2.75 },
  bathroom: { minW: 3.0, minH: 3.5, maxRatio: 2.5 },
  bath: { minW: 3.0, minH: 3.5, maxRatio: 2.5 },
  hall: { minW: 8.5, minH: 9.5, maxRatio: 3.0 },
  parking: { minW: 9.0, minH: 15.0, maxRatio: 3.0 },
  stairs: { minW: 5.5, minH: 10.0, maxRatio: 2.5 },
  duct: { minW: 1.5, minH: 1.5, maxRatio: 5.0 },
  balcony: { minW: 2.5, minH: 2.5, maxRatio: 4.0 },
  passage: { minW: 3.0, minH: 3.0, maxRatio: 10.0 },
};

export function roomType(room: RenderedRoomBox): string {
  const n = `${room.type || ""} ${room.name || ""}`.toLowerCase();
  if (n.includes("parking") || n.includes("porch")) return "parking";
  if (n.includes("stair")) return "stairs";
  if (n.includes("master")) return "master-bedroom";
  if (n.includes("bedroom") || n.includes("bed")) return "bedroom";
  if (n.includes("kitchen") && (n.includes("dining") || n.includes("cum"))) return "kitchen-dining";
  if (n.includes("kitchen")) return "kitchen";
  if (n.includes("dining")) return "dining";
  if (n.includes("bath") || n.includes("toilet") || n.includes("wc")) return "bathroom";
  if (n.includes("duct") || n.includes("ots") || n.includes("shaft") || n.includes("ventilation")) return "duct";
  if (n.includes("balcony")) return "balcony";
  if (n.includes("passage") || n.includes("corridor") || n.includes("foyer")) return "passage";
  if (n.includes("hall") || n.includes("living") || n.includes("drawing")) return "hall";
  return "room";
}

function touches(a: RenderedRoomBox, b: RenderedRoomBox): boolean {
  const horizontal = Math.abs((a.y + a.h) - b.y) <= EPS || Math.abs(a.y - (b.y + b.h)) <= EPS;
  const vertical = Math.abs((a.x + a.w) - b.x) <= EPS || Math.abs(a.x - (b.x + b.w)) <= EPS;
  const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return (horizontal && xOverlap > 0.2) || (vertical && yOverlap > 0.2);
}

function sharedDoorWall(a: RenderedRoomBox, b: RenderedRoomBox): { aWall: string; bWall: string } | null {
  const eps = 0.2;
  const aRight = Math.abs(a.x + a.w - b.x) <= eps;
  const bRight = Math.abs(b.x + b.w - a.x) <= eps;
  const aBottom = Math.abs(a.y + a.h - b.y) <= eps;
  const bBottom = Math.abs(b.y + b.h - a.y) <= eps;
  if ((aRight || bRight) && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.2) {
    return aRight ? { aWall: "RIGHT", bWall: "LEFT" } : { aWall: "LEFT", bWall: "RIGHT" };
  }
  if ((aBottom || bBottom) && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.2) {
    return aBottom ? { aWall: "BOTTOM", bWall: "TOP" } : { aWall: "TOP", bWall: "BOTTOM" };
  }
  return null;
}

function hasDoorBetween(a: RenderedRoomBox, b: RenderedRoomBox): boolean {
  const boundary = sharedDoorWall(a, b);
  if (!boundary && !touches(a, b)) return false;

  const aDoors = Array.isArray(a.doors) ? a.doors : [];
  const bDoors = Array.isArray(b.doors) ? b.doors : [];

  const explicitDoor = (boundary && (
    aDoors.some((d) => d?.wall === boundary.aWall && Number(d.widthFeet || 0) > 0) ||
    bDoors.some((d) => d?.wall === boundary.bWall && Number(d.widthFeet || 0) > 0)
  ));

  if (explicitDoor) return true;

  // Fallback: If layout doors are not populated yet, assume valid touch enables access
  const totalDoors = aDoors.length + bDoors.length;
  return totalDoors === 0 ? touches(a, b) : false;
}

function bfsConnected(rooms: RenderedRoomBox[], start: number): Set<number> {
  const visited = new Set<number>([start]);
  const q = [start];
  while (q.length) {
    const i = q.shift()!;
    for (let j = 0; j < rooms.length; j++) {
      if (visited.has(j) || i === j) continue;
      if (hasDoorBetween(rooms[i], rooms[j])) {
        visited.add(j);
        q.push(j);
      }
    }
  }
  return visited;
}

export function validateConstructionPlan(
  plotArea: number,
  selectedFloors: string[],
  floorData: Record<string, FloorData | any>,
  _floorRoomsConfig: Record<string, Record<string, FloorRoom> | FloorRoom[]>,
  renderedLayoutMap?: Record<string, RenderedRoomBox[]>,
  roadOrientation: "NORTH" | "SOUTH" | "EAST" | "WEST" = "NORTH"
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const floor of selectedFloors) {
    const info: any = floorData?.[floor] || {};
    const floorW = Number(info.clearWidth ?? info.planningWidth ?? info.width ?? 0);
    const floorH = Number(info.clearLength ?? info.planningLength ?? info.length ?? 0);
    const floorArea = Number(info.area || (floorW * floorH) || 0);
    const layout = renderedLayoutMap?.[floor] || [];
    const isGround = floor.toUpperCase().includes("GROUND") || floor.toUpperCase().includes("BASEMENT");
    const isTower = floor.toUpperCase().includes("TOWER") || floor.toUpperCase().includes("MUMTY");

    if (floorArea <= 0 || floorW <= 0 || floorH <= 0) {
      errors.push({ floor, severity: "ERROR", message: `${floor}: Invalid floor planning dimensions.` });
      continue;
    }

    if (plotArea > 0 && Number(info.outerArea ?? floorArea) > plotArea + 2.0) {
      errors.push({
        floor,
        severity: "ERROR",
        message: `${floor}: Floor footprint exceeds plot area.`,
      });
    }

    if (!layout.length) {
      errors.push({ floor, severity: "ERROR", message: `${floor}: No generated room geometry available.` });
      continue;
    }

    const parking = layout.find((r) => roomType(r) === "parking");
    const hall = layout.find((r) => roomType(r) === "hall");
    const stairs = layout.find((r) => roomType(r) === "stairs");
    const bathrooms = layout.filter((r) => roomType(r) === "bathroom");
    const ducts = layout.filter((r) => roomType(r) === "duct");
    const passages = layout.filter((r) => roomType(r) === "passage");
    const circulationLayout = layout.filter((r) => roomType(r) !== "duct" && !(r as any).subZoneOf && !(r as any).isSubRoom && (r as any).parkingZone !== "EXTENSION" && !String(r.name || "").toUpperCase().includes("OPEN TERRACE"));

    // Passage is protected geometry, not leftover space. Any real room/stair/column-zone
    // crossing it is a HARD ERROR; the planner must reject/re-plan instead of showing a
    // warning-only invalid map.
    for (const passage of passages) {
      const minPassageWidth = Number((passage as any).corridorWidthFt || Math.min(passage.w, passage.h) || 0);
      if (minPassageWidth < 3.0 - EPS) {
        errors.push({ floor, roomKey: passage.name, severity: "ERROR", message: `${floor}: PASSAGE width ${minPassageWidth.toFixed(2)} ft is below the protected circulation minimum.` });
      }
      for (const other of layout) {
        if (other === passage || roomType(other) === "duct" || (other as any).subZoneOf) continue;
        const overlapX = Math.min(passage.x + passage.w, other.x + other.w) - Math.max(passage.x, other.x);
        const overlapY = Math.min(passage.y + passage.h, other.y + other.h) - Math.max(passage.y, other.y);
        if (overlapX > 0.15 && overlapY > 0.15) {
          errors.push({ floor, roomKey: passage.name, severity: "ERROR", message: `${floor}: PASSAGE BLOCKED/CUT by ${other.name}. The protected circulation zone cannot be crossed.` });
        }
      }
      const touchingRooms = layout.filter(r => r !== passage && roomType(r) !== "duct" && touches(passage, r));
      if (touchingRooms.length < 2) {
        errors.push({ floor, roomKey: passage.name, severity: "ERROR", message: `${floor}: PASSAGE does not connect at least two usable spaces.` });
      }
    }

    // The architectural engine may attach the exact generated program here.
    // Every required room must exist; missing input requirements are HARD errors, not warnings.
    const requestedProgram: string[] = Array.isArray(info.requestedProgram) ? info.requestedProgram.map((x: any) => String(x).toUpperCase()) : [];
    if (requestedProgram.length) {
      const canonical = (value: string) => {
        const n = value.toUpperCase();
        if (n.includes('KITCHEN') && (n.includes('DINING') || n.includes('CUM'))) return 'KITCHEN CUM DINING';
        if (n.includes('MASTER')) return 'MASTER BEDROOM';
        if (n.includes('BEDROOM') || n === 'BED') return 'BEDROOM';
        if (n.includes('LIVING') || n.includes('DRAWING') || n === 'HALL') return 'LIVING ROOM';
        if (n.includes('ATTACHED') && (n.includes('TOILET') || n.includes('BATH'))) return 'ATTACHED TOILET';
        if (n.includes('COMMON') && (n.includes('TOILET') || n.includes('BATH'))) return 'COMMON TOILET';
        if (n.includes('TOILET') || n.includes('BATH') || n === 'WC') return 'COMMON TOILET';
        if (n.includes('STAIR')) return 'STAIRCASE';
        if (n.includes('PARK')) return 'PARKING';
        if (n.includes('DUCT') || n.includes('OTS') || n.includes('SHAFT')) return 'DUCT';
        return n;
      };
      const wanted: Record<string, number> = {};
      const actual: Record<string, number> = {};
      for (const value of requestedProgram) wanted[canonical(value)] = (wanted[canonical(value)] || 0) + 1;
      for (const room of layout) actual[canonical(String(room.name || 'ROOM'))] = (actual[canonical(String(room.name || 'ROOM'))] || 0) + 1;
      for (const [key, count] of Object.entries(wanted)) {
        if ((actual[key] || 0) < count) errors.push({ floor, roomKey: key, severity: 'ERROR', message: `${floor}: Requested room missing from final geometry → ${key} (${actual[key] || 0}/${count}).` });
      }
    }

    // 1. Boundary & NBC Room Spec Checks
    for (const r of layout) {
      if (r.x < -EPS || r.y < -EPS || r.x + r.w > floorW + EPS || r.y + r.h > floorH + EPS) {
        errors.push({ floor, roomKey: r.name, severity: "ERROR", message: `${floor} → ${r.name}: Room extends beyond planning boundary.` });
      }

      const type = roomType(r);
      const spec = NBC_ROOM_SPECS[type];
      if (spec) {
        const shortDim = Math.min(r.w, r.h);
        const longDim = Math.max(r.w, r.h);
        const requiredShort = Math.min(spec.minW, spec.minH);
        const requiredLong = Math.max(spec.minW, spec.minH);
        const ratio = longDim / Math.max(0.1, shortDim);
        // Compare orientation-independent dimensions correctly. The old check compared
        // the short side against BOTH minima, incorrectly warning on valid 9×15 parking
        // and 6×10 stair footprints.
        if (shortDim + EPS < requiredShort || longDim + EPS < requiredLong) {
          warnings.push({ floor, roomKey: r.name, severity: "WARNING", message: `${floor} → ${r.name}: Compact size (${r.w.toFixed(1)}' × ${r.h.toFixed(1)}') is below preferred NBC standard.` });
        }
        if (ratio > spec.maxRatio) {
          warnings.push({ floor, roomKey: r.name, severity: "WARNING", message: `${floor} → ${r.name}: Elongated room aspect ratio (${ratio.toFixed(1)}:1).` });
        }
      }
    }

    // 2. Spatial Collision Detection
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i];
        const b = layout[j];
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const aContainer = isTower || String(a.name || "").toUpperCase().includes("OPEN TERRACE");
        const bContainer = isTower || String(b.name || "").toUpperCase().includes("OPEN TERRACE");

        const aSub = (a as any).subZoneOf || (a as any).isSubRoom;
        const bSub = (b as any).subZoneOf || (b as any).isSubRoom;
        if (!aSub && !bSub && !aContainer && !bContainer && overlapX > 0.35 && overlapY > 0.35) {
          errors.push({ floor, severity: "ERROR", message: `${floor}: Spatial overlap between "${a.name}" and "${b.name}".` });
        }
      }
    }

    // 3. Dynamic Road Orientation Parking Check
    if (isGround && parking) {
      // The master engine uses a normalized coordinate system: MAIN ROAD is ALWAYS
      // local BOTTOM. roadOrientation only rotates the final CAD sheet.
      const parkingAtFront = parking.y + parking.h >= floorH - 1.5;
      if (!parkingAtFront) {
        warnings.push({ floor, roomKey: parking.name, severity: "WARNING", message: `${floor}: Parking is not on the normalized MAIN ROAD/front edge. Actual road direction is ${roadOrientation}; CAD rotation handles it.` });
      }
    }

    // 4. Hall / Living Room Accessibility
    if (hall && isGround) {
      const directOrOneHop = (parking && (hasDoorBetween(hall, parking) || touches(hall, parking))) ||
        layout.some((r) => ["passage", "porch", "stairs", "foyer"].includes(roomType(r)) && touches(r, hall));

      if (!directOrOneHop) {
        warnings.push({ floor, roomKey: hall.name, severity: "WARNING", message: `${floor}: Main living hall has no direct entry passage from the entrance.` });
      }
    }

    // 5. Staircase Check
    if (stairs && !isTower) {
      if (stairs.w < 5.0 || stairs.h < 7.0) {
        warnings.push({ floor, roomKey: stairs.name, severity: "WARNING", message: `${floor}: Staircase footprint (${stairs.w.toFixed(1)}' × ${stairs.h.toFixed(1)}') is compact.` });
      }
    }

    // 6. Ventilation Check
    if (bathrooms.length > 0) {
      for (const bath of bathrooms) {
        const ventilated = (bath.windows || []).length > 0 || ducts.some((d) => touches(bath, d));
        if (!ventilated && floorH >= 35) {
          warnings.push({ floor, roomKey: bath.name, severity: "WARNING", message: `${floor} → ${bath.name}: Needs an OTS duct or ventilator for proper air circulation.` });
        }
      }
    }

    // 7. Connectivity BFS Check
    if (circulationLayout.length > 1 && !isTower) {
      const startRoom = circulationLayout.find((r) => ["parking", "hall", "passage"].includes(roomType(r))) || circulationLayout[0];
      const startIndex = Math.max(0, circulationLayout.indexOf(startRoom));
      const connected = bfsConnected(circulationLayout, startIndex);

      if (connected.size < circulationLayout.length) {
        for (let i = 0; i < circulationLayout.length; i++) {
          if (!connected.has(i)) {
            errors.push({ floor, roomKey: circulationLayout[i].name, severity: "ERROR", message: `${floor}: ${circulationLayout[i].name} has no generated door/opening path to the circulation network.` });
          }
        }
      }
    }
  }

  const result = { isValid: errors.length === 0, errors, warnings };
  if (typeof console !== 'undefined') {
    console.log('[VALIDATION ENGINE] RESULT', {
      isValid: result.isValid,
      errors: result.errors.map(e => ({ floor: e.floor, room: e.roomKey, message: e.message })),
      warnings: result.warnings.map(w => ({ floor: w.floor, room: w.roomKey, message: w.message })),
    });
  }
  return result;
}