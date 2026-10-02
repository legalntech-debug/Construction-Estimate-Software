/* =========================================================
   CONSTRUCTION PLAN SYSTEM — ARCHITECTURAL VALIDATION ENGINE
========================================================= */

import { FloorData, FloorRoom, PlacedDoor, PlacedWindow } from "./planningTypes";

export type RenderedRoomBox = {
  id?: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  doors?: PlacedDoor[];
  windows?: PlacedWindow[];
  subZoneOf?: string;
  isSubRoom?: boolean;
  servesRooms?: string[];
  collisionChecked?: boolean;
  placedAtCorner?: string;
  pinkGuideLines?: boolean;
  corridorWidthFt?: number;
  staircaseType?: string;
  staircaseSpec?: any;
  verticalCore?: boolean;
  accessSide?: string;
  upperFloorCore?: boolean;
  landingRequired?: boolean;
  stairAccessZone?: string;
  allowGroundAlignment?: boolean;
  entryZone?: boolean;
  publicCore?: boolean;
  parkingAdjacent?: boolean;
  behindParking?: boolean;
  parkingFirstAccess?: boolean;
  upperFloorLiving?: boolean;
  roadConnected?: boolean;
  privateZone?: boolean;
  furnitureValidated?: boolean;
  requestedArea?: number;
  serviceZone?: boolean;
  ventilationRequired?: boolean;
  dimensionsFitted?: boolean;
  serviceCore?: boolean;
  openToSky?: boolean;
  verticalStack?: boolean;
  ventilationFor?: string;
  attachedTo?: string;
  privacy?: string;
  accessRole?: string;
  circulationZone?: boolean;
  protectedCorridor?: boolean;
  connects?: string[];
  orientation?: string;
  diningAdjacent?: boolean;
  adjacentTo?: string;
  circulationSide?: string;
  ventilationEdge?: string;
  parkingShape?: string;
  parkingZone?: string;
  vehicleFit?: boolean;
  vehicleClearanceRequired?: boolean;
  candidateScore?: number;
  parkingMode?: string;
  bikeZone?: any;
  pedestrianZone?: any;
  entryRole?: string;
  standaloneToilet?: boolean;
  fallbackPlacement?: boolean;
  optionalZone?: boolean;
  bathroomIndex?: number;
  isOpen?: boolean;
  exteriorProjection?: boolean;
  placementRule?: string;
  inheritedFrom?: string;
  [key: string]: any;
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
  /**
   * ✅ NEW: UI helper flags
   * - bannerText: what to show in the banner (if shown at all)
   * - autoHideBanner: if true, the UI should NOT show the banner by default
   *   (only when the user manually toggles it)
   */
  bannerText: string;
  autoHideBanner: boolean;
};

const EPS = 0.15;

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

// ============================================================
// HELPER FUNCTIONS FOR SUB-ROOM / PARENT-CHILD DETECTION
// ============================================================

function isParentChild(a: RenderedRoomBox, b: RenderedRoomBox): boolean {
  if (!a || !b) return false;
  const aParent = (a as any).subZoneOf;
  const bParent = (b as any).subZoneOf;

  if (bParent && a.id && bParent === a.id) return true;
  if (aParent && b.id && aParent === b.id) return true;
  if (aParent && bParent && aParent === bParent) return true;

  return false;
}

function isSubRoom(room: RenderedRoomBox): boolean {
  return !!((room as any).subZoneOf || (room as any).isSubRoom);
}

function isServiceCore(room: RenderedRoomBox): boolean {
  const t = roomType(room);
  return t === "duct" || t === "balcony" || t === "stairs";
}

// ============================================================
// STAIR VERTICAL ALIGNMENT RULE
// ============================================================
function validateStairVerticalAlignment(
  floors: Record<string, RenderedRoomBox[]>,
  selectedFloors: string[],
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const groundFloorName = selectedFloors.find(f => f.toUpperCase().includes('GROUND'));
  if (!groundFloorName) return { errors, warnings };

  const groundRooms = floors[groundFloorName] || [];
  const groundStair = groundRooms.find(r => roomType(r) === 'stairs');
  if (!groundStair) return { errors, warnings };

  const groundHost = groundStair.subZoneOf
    ? groundRooms.find(r => r.id === groundStair.subZoneOf)
    : groundRooms.find(r => roomType(r) === 'hall');

  const groundOffset = groundHost
    ? { dx: groundStair.x - groundHost.x, dy: groundStair.y - groundHost.y }
    : { dx: groundStair.x, dy: groundStair.y };

  for (const floorName of selectedFloors) {
    if (floorName === groundFloorName) continue;
    if (floorName.toUpperCase().includes('TOWER') || floorName.toUpperCase().includes('MUMTY')) continue;

    const upperRooms = floors[floorName] || [];
    const upperStair = upperRooms.find(r => roomType(r) === 'stairs');
    if (!upperStair) continue;

    const upperHost = upperStair.subZoneOf
      ? upperRooms.find(r => r.id === upperStair.subZoneOf)
      : upperRooms.find(r => roomType(r) === 'hall');

    const upperOffset = upperHost
      ? { dx: upperStair.x - upperHost.x, dy: upperStair.y - upperHost.y }
      : { dx: upperStair.x, dy: upperStair.y };

    const dx = Math.abs(groundOffset.dx - upperOffset.dx);
    const dy = Math.abs(groundOffset.dy - upperOffset.dy);
    const TOLERANCE_FT = 2.0;

    if (dx > TOLERANCE_FT || dy > TOLERANCE_FT) {
      errors.push({
        floor: floorName,
        roomKey: upperStair.name,
        severity: 'ERROR',
        message: `${floorName}: STAIRCASE is not vertically aligned with GROUND FLOOR stair. Ground offset (${groundOffset.dx.toFixed(2)}, ${groundOffset.dy.toFixed(2)}) vs upper offset (${upperOffset.dx.toFixed(2)}, ${upperOffset.dy.toFixed(2)}). Delta: ${dx.toFixed(2)}, ${dy.toFixed(2)} ft. Stair must be at the same relative position on every floor.`,
      });
    } else if (dx > 0.5 || dy > 0.5) {
      warnings.push({
        floor: floorName,
        roomKey: upperStair.name,
        severity: 'WARNING',
        message: `${floorName}: STAIRCASE alignment with GROUND FLOOR is within tolerance but off by (${dx.toFixed(2)}, ${dy.toFixed(2)}) ft.`,
      });
    }
  }

  return { errors, warnings };
}

// ============================================================
// ✅ NEW: Banner text builder — UI component isko use kare
// ============================================================
function buildBannerText(result: { isValid: boolean; errors: ValidationError[]; warnings: ValidationError[] }): {
  bannerText: string;
  autoHideBanner: boolean;
} {
  if (!result.isValid) {
    return {
      bannerText: `⚠️ INVALID PLAN (${result.errors.length} ERROR${result.errors.length === 1 ? '' : 'S'})`,
      autoHideBanner: false, // invalid → always show
    };
  }
  // ✅ Valid plan → auto-hide banner (user can toggle manually)
  return {
    bannerText: `✅ PLAN VALIDATED BY ENGINE${result.warnings.length ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})` : ''}`,
    autoHideBanner: true,
  };
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
      errors.push({ floor, severity: "ERROR", message: `${floor}: Floor footprint exceeds plot area.` });
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

    const circulationLayout = layout.filter((r) =>
      roomType(r) !== "duct" &&
      !isSubRoom(r) &&
      (r as any).parkingZone !== "EXTENSION" &&
      !String(r.name || "").toUpperCase().includes("OPEN TERRACE")
    );

    // PASSAGE PROTECTED ZONE CHECK
    for (const passage of passages) {
      const minPassageWidth = Number((passage as any).corridorWidthFt || Math.min(passage.w, passage.h) || 0);
      if (minPassageWidth < 3.0 - EPS) {
        errors.push({
          floor, roomKey: passage.name, severity: "ERROR",
          message: `${floor}: PASSAGE width ${minPassageWidth.toFixed(2)} ft is below the protected circulation minimum.`,
        });
      }

      for (const other of layout) {
        if (other === passage) continue;
        if (roomType(other) === "duct") continue;
        if (isSubRoom(other)) continue;
        if (isParentChild(passage, other)) continue;

        const overlapX = Math.min(passage.x + passage.w, other.x + other.w) - Math.max(passage.x, other.x);
        const overlapY = Math.min(passage.y + passage.h, other.y + other.h) - Math.max(passage.y, other.y);
        if (overlapX > 0.15 && overlapY > 0.15) {
          errors.push({
            floor, roomKey: passage.name, severity: "ERROR",
            message: `${floor}: PASSAGE BLOCKED/CUT by ${other.name}. The protected circulation zone cannot be crossed.`,
          });
        }
      }

      const touchingRooms = layout.filter(r =>
        r !== passage &&
        roomType(r) !== "duct" &&
        !isSubRoom(r) &&
        touches(passage, r)
      );
      if (touchingRooms.length < 2) {
        errors.push({
          floor, roomKey: passage.name, severity: "ERROR",
          message: `${floor}: PASSAGE does not connect at least two usable spaces.`,
        });
      }
    }

    // REQUESTED PROGRAM CHECK
    const requestedProgram: string[] = Array.isArray(info.requestedProgram) ? info.requestedProgram.map((x: any) => String(x).toUpperCase()) : [];
    if (requestedProgram.length) {
      const canon = (value: string) => {
        const nv = value.toUpperCase();
        if (nv.includes('KITCHEN') && (nv.includes('DINING') || nv.includes('CUM'))) return 'KITCHEN CUM DINING';
        if (nv.includes('MASTER')) return 'MASTER BEDROOM';
        if (nv.includes('BEDROOM') || nv === 'BED') return 'BEDROOM';
        if (nv.includes('LIVING') || nv.includes('DRAWING') || nv === 'HALL') return 'LIVING ROOM';
        if (nv.includes('ATTACHED') && (nv.includes('TOILET') || nv.includes('BATH'))) return 'ATTACHED TOILET';
        if (nv.includes('COMMON') && (nv.includes('TOILET') || nv.includes('BATH'))) return 'COMMON TOILET';
        if (nv.includes('BATH') && !nv.includes('ATTACHED')) return 'BATHROOM';
        if (nv.includes('TOILET') || nv === 'WC') return 'COMMON TOILET';
        if (nv.includes('STAIR')) return 'STAIRCASE';
        if (nv.includes('PARK')) return 'PARKING';
        if (nv.includes('DUCT') || nv.includes('OTS') || nv.includes('SHAFT')) return 'DUCT';
        return nv;
      };
      const wanted: Record<string, number> = {};
      const actual: Record<string, number> = {};
      for (const value of requestedProgram) wanted[canon(value)] = (wanted[canon(value)] || 0) + 1;
      for (const room of layout) actual[canon(String(room.name || 'ROOM'))] = (actual[canon(String(room.name || 'ROOM'))] || 0) + 1;
      for (const [key, count] of Object.entries(wanted)) {
        const actualCount = key === 'BATHROOM'
          ? (actual['BATHROOM'] || 0) + (actual['ATTACHED TOILET'] || 0)
          : (actual[key] || 0);
        if (actualCount < count) {
          errors.push({ floor, roomKey: key, severity: 'ERROR', message: `${floor}: Requested room missing from final geometry → ${key} (${actualCount}/${count}).` });
        }
      }
    }

    // OPENING GEOMETRY AUDIT
    for (const r of layout) {
      const spans: Record<string, number> = { TOP: r.w, BOTTOM: r.w, LEFT: r.h, RIGHT: r.h };
      for (const d of (r.doors || [])) {
        const wallLen = spans[String(d.wall || '').toUpperCase()] || 0;
        const start = Number(d.offsetFeet || 0);
        const width = Number(d.widthFeet || 0);
        if (!wallLen || start < -EPS || width <= 0 || start + width > wallLen + EPS) {
          errors.push({ floor, roomKey: r.name, severity: 'ERROR', message: `${floor}: Door/gate geometry invalid in ${r.name} → ${d.id || 'DOOR'} on ${d.wall}; offset ${start.toFixed(2)} + width ${width.toFixed(2)} exceeds wall span ${wallLen.toFixed(2)}.` });
        }
      }
    }

    // BOUNDARY & NBC SPEC CHECKS
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
        if (shortDim + EPS < requiredShort || longDim + EPS < requiredLong) {
          warnings.push({ floor, roomKey: r.name, severity: "WARNING", message: `${floor} → ${r.name}: Compact size (${r.w.toFixed(1)}' × ${r.h.toFixed(1)}') is below preferred NBC standard.` });
        }
        if (ratio > spec.maxRatio) {
          warnings.push({ floor, roomKey: r.name, severity: "WARNING", message: `${floor} → ${r.name}: Elongated room aspect ratio (${ratio.toFixed(1)}:1).` });
        }
      }
    }

    // SPATIAL COLLISION DETECTION
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i];
        const b = layout[j];

        const aContainer = isTower || String(a.name || "").toUpperCase().includes("OPEN TERRACE");
        const bContainer = isTower || String(b.name || "").toUpperCase().includes("OPEN TERRACE");
        if (aContainer || bContainer) continue;
        if (isSubRoom(a) || isSubRoom(b)) continue;
        if (isParentChild(a, b)) continue;
        if (roomType(a) === 'duct' || roomType(b) === 'duct') continue;

        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

        if (overlapX > 0.5 && overlapY > 0.5) {
          errors.push({ floor, severity: "ERROR", message: `${floor}: Spatial overlap between "${a.name}" and "${b.name}" (Δx=${overlapX.toFixed(2)}, Δy=${overlapY.toFixed(2)}).` });
        }
      }
    }

    // PARKING FRONT-EDGE CHECK
    if (isGround && parking) {
      const parkingAtFront = parking.y + parking.h >= floorH - 1.5;
      if (!parkingAtFront) {
        warnings.push({ floor, roomKey: parking.name, severity: "WARNING", message: `${floor}: Parking is not on the normalized MAIN ROAD/front edge. Actual road direction is ${roadOrientation}; CAD rotation handles it.` });
      }
    }

    // HALL / LIVING ROOM ACCESSIBILITY
    if (hall && isGround) {
      const directOrOneHop = (parking && (hasDoorBetween(hall, parking) || touches(hall, parking))) ||
        layout.some((r) => ["passage", "porch", "stairs", "foyer"].includes(roomType(r)) && !isSubRoom(r) && touches(r, hall));

      if (!directOrOneHop) {
        warnings.push({ floor, roomKey: hall.name, severity: "WARNING", message: `${floor}: Main living hall has no direct entry passage from the entrance.` });
      }
    }

    // STAIRCASE CHECK
    if (stairs && !isTower) {
      if (stairs.w < 5.0 || stairs.h < 7.0) {
        warnings.push({ floor, roomKey: stairs.name, severity: "WARNING", message: `${floor}: Staircase footprint (${stairs.w.toFixed(1)}' × ${stairs.h.toFixed(1)}') is compact.` });
      }

      const stairsIsSub = isSubRoom(stairs);

      if (!stairsIsSub) {
        for (const other of layout) {
          if (other === stairs) continue;
          if (isSubRoom(other)) continue;
          if (isParentChild(stairs, other)) continue;
          if (roomType(other) === 'duct') continue;

          const ox = Math.min(stairs.x + stairs.w, other.x + other.w) - Math.max(stairs.x, other.x);
          const oy = Math.min(stairs.y + stairs.h, other.y + other.h) - Math.max(stairs.y, other.y);
          if (ox > 0.5 && oy > 0.5) {
            const isPassage = roomType(other) === "passage";
            errors.push({
              floor, roomKey: stairs.name, severity: "ERROR",
              message: `${floor}: STAIRCASE collides with ${other.name}${isPassage ? " (PASSAGE BLOCKED)" : ""}. Staircase placement must not block circulation.`,
            });
          }
        }
      }
    }

    // VENTILATION CHECK
    if (bathrooms.length > 0) {
      for (const bath of bathrooms) {
        const ventilated = (bath.windows || []).length > 0 || ducts.some((d) => touches(bath, d));
        if (!ventilated && floorH >= 35) {
          warnings.push({ floor, roomKey: bath.name, severity: "WARNING", message: `${floor} → ${bath.name}: Needs an OTS duct or ventilator for proper air circulation.` });
        }
      }
    }

    // CONNECTIVITY BFS CHECK
    if (circulationLayout.length > 1 && !isTower) {
      const startRoom = circulationLayout.find((r) => ["parking", "hall", "passage"].includes(roomType(r))) || circulationLayout[0];
      const startIndex = Math.max(0, circulationLayout.indexOf(startRoom));
      const connected = bfsConnected(circulationLayout, startIndex);

      if (connected.size < circulationLayout.length) {
        for (let i = 0; i < circulationLayout.length; i++) {
          if (!connected.has(i)) {
            const room = circulationLayout[i];
            if (isSubRoom(room)) continue;
            if (isServiceCore(room)) continue;
            errors.push({ floor, roomKey: room.name, severity: "ERROR", message: `${floor}: ${room.name} has no generated door/opening path to the circulation network.` });
          }
        }
      }
    }

    // PASSAGE-FIRST ORDERING CHECK
    if (passages.length > 0 && !isTower) {
      const realRooms = layout.filter(
        r => !isSubRoom(r) && roomType(r) !== "duct" && r !== parking
      );
      const passageSet = new Set(passages);
      const reachable = new Set<RenderedRoomBox>();
      const queue: RenderedRoomBox[] = [...passages];
      while (queue.length) {
        const cur = queue.shift()!;
        if (reachable.has(cur)) continue;
        reachable.add(cur);
        for (const other of realRooms) {
          if (reachable.has(other)) continue;
          if (touches(cur, other)) {
            queue.push(other);
          }
        }
      }
      for (const room of realRooms) {
        if (passageSet.has(room)) continue;
        if (!reachable.has(room)) {
          warnings.push({
            floor, roomKey: room.name, severity: "WARNING",
            message: `${floor}: ${room.name} is not reachable from any PASSAGE — zoning order may be wrong.`,
          });
        }
      }
    }
  }

  // STAIR VERTICAL ALIGNMENT across floors
  if (renderedLayoutMap && selectedFloors.length > 1) {
    const alignmentResult = validateStairVerticalAlignment(renderedLayoutMap, selectedFloors);
    errors.push(...alignmentResult.errors);
    warnings.push(...alignmentResult.warnings);
  }

  const baseResult = { isValid: errors.length === 0, errors, warnings };
  const { bannerText, autoHideBanner } = buildBannerText(baseResult);

  const result: ValidationResult = { ...baseResult, bannerText, autoHideBanner };

  // ✅ Quieter log — only summary
  if (typeof console !== 'undefined') {
    console.log('[VALIDATION ENGINE]', {
      isValid: result.isValid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    });
  }

  return result;
}