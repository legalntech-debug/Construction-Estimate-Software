/* =========================================================
   CONSTRUCTION PLAN SYSTEM — DOOR / WINDOW / ACCESS ENGINE
   Generates a connected door graph from actual room geometry.
========================================================= */

import { DoorWindowSpec, PlacedDoor, PlacedWindow } from "./planningTypes";

export interface RoomLayout {
  id?: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type?: string;
  doors?: PlacedDoor[];
  windows?: PlacedWindow[];
}

export interface SharedBoundary {
  roomAIndex: number;
  roomBIndex: number;
  wallForA: "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  wallForB: "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  overlapStart: number;
  overlapEnd: number;
  length: number;
}

export interface SetbackMosSpec {
  front: number;
  back: number;
  left: number;
  right: number;
}

const TOLERANCE = 0.08;
const EXT_TOLERANCE = 0.5;
const EDGE_OFFSET = 0.5;

export function calculateDoorsAndWindows(totalBuiltUpArea: number, floorCount: number, hasTower: boolean): DoorWindowSpec {
  const base = totalBuiltUpArea > 2000 ? 8 : totalBuiltUpArea > 1500 ? 7 : totalBuiltUpArea > 1000 ? 6 : totalBuiltUpArea > 600 ? 5 : 4;
  const mainDoors = Math.max(1, floorCount);
  const bathroomDoors = Math.max(2, floorCount * 2);
  const internalDoors = Math.max(0, base * floorCount - mainDoors - bathroomDoors);
  return { mainDoors, internalDoors, bathroomDoors, windows: base * 2, ventilators: bathroomDoors };
}

function normalizeType(room: RoomLayout): string {
  const s = `${room.type || ""} ${room.name || ""}`.toLowerCase();
  if (s.includes("parking") || s.includes("porch")) return "parking";
  if (s.includes("stair")) return "stairs";
  if (s.includes("master")) return "master-bedroom";
  if (s.includes("bedroom") || s.includes("bed")) return "bedroom";
  if (s.includes("kitchen")) return "kitchen";
  if (s.includes("dining")) return "dining";
  if (s.includes("bath") || s.includes("toilet") || s.includes("wc")) return "bathroom";
  if (s.includes("duct") || s.includes("ots")) return "duct";
  if (s.includes("balcony")) return "balcony";
  if (s.includes("passage") || s.includes("corridor")) return "passage";
  if (s.includes("pooja") || s.includes("puja") || s.includes("temple")) return "pooja";
  if (s.includes("study")) return "study";
  if (s.includes("hall") || s.includes("living") || s.includes("drawing")) return "hall";
  return "room";
}

/**
 * Detect attached toilet specifically (master-bedroom's sub-toilet).
 * These are sub-rooms and need their own door symbol rendering.
 */
function isAttachedToilet(room: RoomLayout): boolean {
  const name = String(room.name || "").toLowerCase();
  const type = String(room.type || "").toLowerCase();
  return (name.includes("attached") || type.includes("attached")) &&
    (name.includes("toilet") || name.includes("bath") || type.includes("toilet") || type.includes("bath"));
}

export function findSharedBoundary(r1: RoomLayout, idx1: number, r2: RoomLayout, idx2: number): SharedBoundary | null {
  const r1X2 = r1.x + r1.w;
  const r1Y2 = r1.y + r1.h;
  const r2X2 = r2.x + r2.w;
  const r2Y2 = r2.y + r2.h;

  if (Math.abs(r1X2 - r2.x) <= TOLERANCE) {
    const start = Math.max(r1.y, r2.y);
    const end = Math.min(r1Y2, r2Y2);
    if (end - start > 0.6) return { roomAIndex: idx1, roomBIndex: idx2, wallForA: "RIGHT", wallForB: "LEFT", overlapStart: start, overlapEnd: end, length: end - start };
  }
  if (Math.abs(r1.x - r2X2) <= TOLERANCE) {
    const start = Math.max(r1.y, r2.y);
    const end = Math.min(r1Y2, r2Y2);
    if (end - start > 0.6) return { roomAIndex: idx1, roomBIndex: idx2, wallForA: "LEFT", wallForB: "RIGHT", overlapStart: start, overlapEnd: end, length: end - start };
  }
  if (Math.abs(r1Y2 - r2.y) <= TOLERANCE) {
    const start = Math.max(r1.x, r2.x);
    const end = Math.min(r1X2, r2X2);
    if (end - start > 0.6) return { roomAIndex: idx1, roomBIndex: idx2, wallForA: "BOTTOM", wallForB: "TOP", overlapStart: start, overlapEnd: end, length: end - start };
  }
  if (Math.abs(r1.y - r2Y2) <= TOLERANCE) {
    const start = Math.max(r1.x, r2.x);
    const end = Math.min(r1X2, r2X2);
    if (end - start > 0.6) return { roomAIndex: idx1, roomBIndex: idx2, wallForA: "TOP", wallForB: "BOTTOM", overlapStart: start, overlapEnd: end, length: end - start };
  }
  return null;
}

/**
 * Strict Corner Alignment Logic
 * - Parking / Hall: CORNER-align (left or right edge)
 * - Bedroom/Bathroom: corner align
 * - Passage: center-align
 * - Others: center-align
 */
function localOffset(boundary: SharedBoundary, width: number, room: RoomLayout, roomType: string): number {
  const vertical = boundary.wallForA === "LEFT" || boundary.wallForA === "RIGHT";
  const start = boundary.overlapStart;
  const end = boundary.overlapEnd;
  const roomStart = vertical ? room.y : room.x;

  // Parking or Hall → CORNER ALIGN
  if (roomType === "parking" || roomType === "hall") {
    const roomCenter = vertical ? (room.y + room.h / 2) : (room.x + room.w / 2);
    const wallCenter = (start + end) / 2;
    const preferLeft = roomCenter <= wallCenter;

    if (preferLeft) {
      return Math.max(EDGE_OFFSET, (start - roomStart) + 0.5);
    } else {
      const rightStart = (end - width) - roomStart;
      return Math.max(EDGE_OFFSET, rightStart - 0.5);
    }
  }

  // Bedrooms, bathrooms
  if (roomType === "bathroom" || roomType === "bedroom" || roomType === "master-bedroom") {
    return Math.max(EDGE_OFFSET, (start - roomStart) + 0.3);
  }

  // Passage — center align
  if (roomType === "passage") {
    const center = (start + end) / 2;
    const centerStart = center - width / 2;
    return Math.max(EDGE_OFFSET, centerStart - roomStart);
  }

  // Default — center align
  const center = (start + end) / 2;
  const centerStart = center - width / 2;
  return Math.max(EDGE_OFFSET, centerStart - roomStart);
}

function addDoor(
  room: RoomLayout,
  wall: PlacedDoor["wall"],
  offsetFeet: number,
  widthFeet: number,
  doorType: PlacedDoor["doorType"],
  id: string,
  renderSymbol = true,
  leaves = 1
) {
  room.doors = room.doors || [];
  const max = wall === "LEFT" || wall === "RIGHT" ? room.h : room.w;
  const width = Math.min(widthFeet, Math.max(2, max - EDGE_OFFSET * 2));
  const offset = Math.max(EDGE_OFFSET, Math.min(offsetFeet, Math.max(EDGE_OFFSET, max - width - EDGE_OFFSET)));
  const exists = room.doors.some((d) => d.wall === wall && Math.abs(d.offsetFeet - offset) < 0.75);

  // Only double-leaf if explicitly requested via `leaves` param.
  // Do NOT auto-double based on door type — MAIN door can be single-leaf
  // for narrow plots.
  const leafCount = leaves > 1 ? 2 : 1;

  if (!exists) {
    room.doors.push({
      id,
      wall,
      offsetFeet: offset,
      widthFeet: width,
      doorType,
      leafCount,
      isDoubleLeaf: leafCount === 2,
      doubleLeaf: leafCount === 2,
      swingDirection: "INWARDS",
      ...(renderSymbol ? {} : { renderSymbol: false }),
      ...(id.startsWith('shared-') ? { sharedOpeningId: id } : {})
    } as any);
  }
}

function addWindow(room: RoomLayout, wall: PlacedWindow["wall"], offsetFeet: number, lengthFeet: number, windowType: PlacedWindow["windowType"], id: string) {
  room.windows = room.windows || [];
  const max = wall === "LEFT" || wall === "RIGHT" ? room.h : room.w;
  const length = Math.min(lengthFeet, Math.max(2, max - 1.0));
  const offset = Math.max(0.5, (max - length) / 2);
  const exists = room.windows.some((w) => w.wall === wall && Math.abs(w.offsetFeet - offset) < 0.75);
  if (!exists) room.windows.push({ id, wall, offsetFeet: offset, lengthFeet: length, windowType });
}

function edgeWall(room: RoomLayout, wall: PlacedDoor["wall"], floorW: number, floorH: number): boolean {
  if (wall === "TOP") return Math.abs(room.y) <= EXT_TOLERANCE;
  if (wall === "BOTTOM") return Math.abs(room.y + room.h - floorH) <= EXT_TOLERANCE;
  if (wall === "LEFT") return Math.abs(room.x) <= EXT_TOLERANCE;
  return Math.abs(room.x + room.w - floorW) <= EXT_TOLERANCE;
}

function exteriorWallForRoom(room: RoomLayout, floorW: number, floorH: number): PlacedDoor["wall"] | null {
  if (edgeWall(room, "BOTTOM", floorW, floorH)) return "BOTTOM";
  if (edgeWall(room, "RIGHT", floorW, floorH)) return "RIGHT";
  if (edgeWall(room, "LEFT", floorW, floorH)) return "LEFT";
  if (edgeWall(room, "TOP", floorW, floorH)) return "TOP";
  return null;
}

export function generateFloorOpenings(
  rooms: RoomLayout[],
  _roadOrientation: "NORTH" | "SOUTH" | "EAST" | "WEST" = "SOUTH",
  floorW?: number,
  floorH?: number,
  setbacks?: SetbackMosSpec
): RoomLayout[] {
  const updated = rooms.map((r) => ({ ...r, doors: [...(r.doors || [])], windows: [...(r.windows || [])] }));
  const W = Number(floorW || Math.max(...updated.map((r) => r.x + r.w), 0));
  const H = Number(floorH || Math.max(...updated.map((r) => r.y + r.h), 0));

  const is = (room: RoomLayout, type: string) => normalizeType(room) === type;
  const isService = (room: RoomLayout) => ["kitchen", "dining", "bathroom", "stairs", "study", "utility", "store"].includes(normalizeType(room));

  const canConnect = (a: RoomLayout, b: RoomLayout) => {
    const ta = normalizeType(a);
    const tb = normalizeType(b);

    if (ta === "duct" || tb === "duct") return false;
    if (ta === "bathroom" && tb === "bathroom") return false;
    if (ta === "parking" && tb === "parking") return false;
    if (ta === "parking" && tb !== "hall") return false;
    if (tb === "parking" && ta !== "hall") return false;

    const privateTypes = ["bedroom", "master-bedroom"];
    if (privateTypes.includes(ta) && privateTypes.includes(tb)) return false;

    return true;
  };

  // ============================================================
  // ADJACENCY GRAPH
  // ============================================================
  const adjacency: { a: number; b: number; boundary: SharedBoundary; score: number }[] = [];
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      if (!canConnect(updated[i], updated[j])) continue;
      const boundary = findSharedBoundary(updated[i], i, updated[j], j);
      if (!boundary) continue;
      const ta = normalizeType(updated[i]);
      const tb = normalizeType(updated[j]);
      let score = boundary.length;

      if ((ta === "parking" && tb === "hall") || (ta === "hall" && tb === "parking")) score += 1000;
      if ((ta === "hall" && ["kitchen", "dining"].includes(tb)) || (tb === "hall" && ["kitchen", "dining"].includes(ta))) score += 850;
      if ((ta === "hall" && ["master-bedroom", "bedroom"].includes(tb)) || (tb === "hall" && ["master-bedroom", "bedroom"].includes(ta))) score += 700;

      if (ta === "passage" || tb === "passage") {
        const otherType = ta === "passage" ? tb : ta;
        if (otherType === "hall" || otherType === "living-room" || otherType === "master-bedroom" || otherType === "bedroom") {
          score += 900;
        } else if (otherType === "kitchen" || otherType === "dining") {
          score += 800;
        } else if (otherType === "bathroom") {
          score += 700;
        } else {
          score += 500;
        }
      }

      if (tb === "bathroom" || ta === "bathroom") score += 600;
      if (isService(updated[i]) && isService(updated[j])) score -= 100;

      adjacency.push({ a: i, b: j, boundary, score });
    }
  }

  // ============================================================
  // ROOT SELECTION
  // ============================================================
  const rootParking = updated.findIndex((r) => is(r, "parking"));
  const rootHall = updated.findIndex((r) => is(r, "hall"));
  const root = rootHall >= 0 ? rootHall : (rootParking >= 0 ? rootParking : 0);
  const connected = new Set<number>([root]);
  const usedEdges = new Set<string>();

  // ============================================================
  // PARKING ↔ HALL (Living Room) — MAIN ENTRY DOOR
  // ============================================================
  if (rootParking >= 0 && rootHall >= 0) {
    const idxEdge = adjacency.findIndex((e) => (e.a === rootParking && e.b === rootHall) || (e.a === rootHall && e.b === rootParking));
    if (idxEdge >= 0) {
      const edge = adjacency[idxEdge];
      const a = updated[edge.a];
      const b = updated[edge.b];

      const parkingRoom = is(a, "parking") ? a : b;
      const hallRoom = is(b, "hall") ? b : a;

      const isNarrowPlot = W <= 20.5;
      const doorWidth = isNarrowPlot
        ? Math.min(3.5, Math.max(3.0, parkingRoom.w * 0.35))
        : Math.min(4.5, Math.max(3.5, parkingRoom.w * 0.45));
      const isDoubleLeaf = !isNarrowPlot && doorWidth >= 4.0;

      const parkingWall = edge.boundary.wallForA;
      const hallWall = edge.boundary.wallForB;

      const sharedWallIsVertical = parkingWall === "LEFT" || parkingWall === "RIGHT";
      const wallStart = sharedWallIsVertical
        ? Math.max(parkingRoom.y, hallRoom.y)
        : Math.max(parkingRoom.x, hallRoom.x);
      const wallEnd = sharedWallIsVertical
        ? Math.min(parkingRoom.y + parkingRoom.h, hallRoom.y + hallRoom.h)
        : Math.min(parkingRoom.x + parkingRoom.w, hallRoom.x + hallRoom.w);
      const wallLength = Math.max(0.1, wallEnd - wallStart);

      // ============================================================
      // Collision check — does the door range conflict with any other
      // room's access on this shared wall?
      // ============================================================
      const checkRange = (gateStart: number, gateEnd: number): boolean => {
        for (const other of updated) {
          if (other === parkingRoom || other === hallRoom) continue;
          const ot = normalizeType(other);
          if (ot === "duct" || ot === "parking") continue;

          if (sharedWallIsVertical) {
            const otherY1 = other.y;
            const otherY2 = other.y + other.h;
            const overlap = Math.min(gateEnd, otherY2) - Math.max(gateStart, otherY1);
            if (overlap > 0.3) {
              const wallX = parkingWall === "LEFT" ? parkingRoom.x : parkingRoom.x + parkingRoom.w;
              const touches =
                Math.abs(other.x + other.w - wallX) < 0.4 ||
                Math.abs(other.x - wallX) < 0.4;
              if (touches) return true;
            }
          } else {
            const otherX1 = other.x;
            const otherX2 = other.x + other.w;
            const overlap = Math.min(gateEnd, otherX2) - Math.max(gateStart, otherX1);
            if (overlap > 0.3) {
              const wallY = parkingWall === "TOP" ? parkingRoom.y : parkingRoom.y + parkingRoom.h;
              const touches =
                Math.abs(other.y + other.h - wallY) < 0.4 ||
                Math.abs(other.y - wallY) < 0.4;
              if (touches) return true;
            }
          }
        }
        return false;
      };

      // ============================================================
      // Choose corner (LEFT/RIGHT) based on Hall position, or CENTER
      // if plot is wide
      // ============================================================
      const cornerLeftOffset = 0.5;
      const cornerRightOffset = Math.max(0.5, wallLength - doorWidth - 0.5);
      const centerOffset = Math.max(0.5, (wallLength - doorWidth) / 2);

      const parkingCenterX = parkingRoom.x + parkingRoom.w / 2;
      const hallCenterX = hallRoom.x + hallRoom.w / 2;
      const preferLeftCorner = hallCenterX <= parkingCenterX;

      let finalWallOffset = preferLeftCorner ? cornerLeftOffset : cornerRightOffset;
      let finalSide: "LEFT" | "RIGHT" | "CENTER" = preferLeftCorner ? "LEFT" : "RIGHT";

      // ============================================================
      // WIDE PLOT: try center first, fall back to corner
      // NARROW PLOT: only corner allowed
      // ============================================================
      if (!isNarrowPlot) {
        const centerGateStart = wallStart + centerOffset;
        const centerGateEnd = centerGateStart + doorWidth;
        if (!checkRange(centerGateStart, centerGateEnd)) {
          finalWallOffset = centerOffset;
          finalSide = "CENTER";
        } else {
          const prefStart = wallStart + finalWallOffset;
          const prefEnd = prefStart + doorWidth;
          if (checkRange(prefStart, prefEnd)) {
            const altOffset = preferLeftCorner ? cornerRightOffset : cornerLeftOffset;
            const altStart = wallStart + altOffset;
            const altEnd = altStart + doorWidth;
            if (!checkRange(altStart, altEnd)) {
              finalWallOffset = altOffset;
              finalSide = preferLeftCorner ? "RIGHT" : "LEFT";
            }
          }
        }
      } else {
        const prefStart = wallStart + finalWallOffset;
        const prefEnd = prefStart + doorWidth;
        if (checkRange(prefStart, prefEnd)) {
          const altOffset = preferLeftCorner ? cornerRightOffset : cornerLeftOffset;
          const altStart = wallStart + altOffset;
          const altEnd = altStart + doorWidth;
          if (!checkRange(altStart, altEnd)) {
            finalWallOffset = altOffset;
            finalSide = preferLeftCorner ? "RIGHT" : "LEFT";
          }
        }
      }

      // ============================================================
      // Convert wall-relative offset → room-relative offset for each room
      // ============================================================
      const parkingRoomLocalStart = sharedWallIsVertical ? parkingRoom.y : parkingRoom.x;
      const hallRoomLocalStart = sharedWallIsVertical ? hallRoom.y : hallRoom.x;

      const parkingLocalOffset = Math.max(EDGE_OFFSET, (wallStart - parkingRoomLocalStart) + finalWallOffset);
      const hallLocalOffset = Math.max(EDGE_OFFSET, (wallStart - hallRoomLocalStart) + finalWallOffset);

      const sharedId = `shared-parking-hall-${edge.a}-${edge.b}`;

      // ============================================================
      // Add door ONLY ONCE:
      //   - Parking side: renderSymbol = false (no symbol on parking)
      //   - Hall side:    renderSymbol = true  (single symbol on living room)
      // ============================================================
      addDoor(
        parkingRoom,
        parkingWall,
        parkingLocalOffset,
        doorWidth,
        "MAIN",
        `shared-${sharedId}`,
        false,
        isDoubleLeaf ? 2 : 1
      );

      addDoor(
        hallRoom,
        hallWall,
        hallLocalOffset,
        doorWidth,
        "MAIN",
        `shared-${sharedId}`,
        true,
        isDoubleLeaf ? 2 : 1
      );

      // Tag metadata on both doors (single shared entry)
      for (const rr of [parkingRoom, hallRoom]) {
        const dd = (rr.doors || []).find((d: any) => d.id === `shared-${sharedId}`);
        if (dd) {
          (dd as any).swingDirection = "INWARDS";
          (dd as any).isDoubleLeaf = isDoubleLeaf;
          (dd as any).doubleLeaf = isDoubleLeaf;
          (dd as any).leafCount = isDoubleLeaf ? 2 : 1;
          (dd as any).placementSide = finalSide;
          (dd as any).entryRole = "MAIN_PARKING_TO_LIVING_DOOR";
          (dd as any).plotWidth = W;
          (dd as any).narrowPlot = isNarrowPlot;
        }
      }

      connected.add(rootParking);
      connected.add(rootHall);
      usedEdges.add(`${Math.min(edge.a, edge.b)}-${Math.max(edge.a, edge.b)}`);
    }
  }

  // ============================================================
  // BFS-LIKE EDGE SELECTION FOR REMAINING ROOMS
  // ============================================================
  while (connected.size < updated.length) {
    const candidates = adjacency
      .filter((e) => connected.has(e.a) !== connected.has(e.b))
      .filter((e) => !usedEdges.has(`${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`))
      .sort((a, b) => b.score - a.score);
    if (!candidates.length) break;
    const edge = candidates[0];
    const roomA = updated[edge.a];
    const roomB = updated[edge.b];
    const ta = normalizeType(roomA);
    const tb = normalizeType(roomB);

    const isBathroom = ta === "bathroom" || tb === "bathroom";
    const isPooja = ta === "pooja" || tb === "pooja";
    const isKitchenHall = (ta === "kitchen" && tb === "hall") || (ta === "hall" && tb === "kitchen");
    const isPassageConnect = ta === "passage" || tb === "passage";

    const width = isBathroom ? 2.5 : isPooja ? 2.5 : isKitchenHall ? 3.5 : 3.0;

    if (isPooja && (edge.boundary.wallForA === "BOTTOM" || edge.boundary.wallForB === "BOTTOM")) {
      usedEdges.add(`${Math.min(edge.a, edge.b)}-${Math.max(edge.a, edge.b)}`);
      continue;
    }

    const sharedId = `shared-${edge.a}-${edge.b}`;
    const openingDoorType = isBathroom ? "BATHROOM" : "INTERNAL";

    const passageRoomType = ta === "passage" ? tb : (tb === "passage" ? ta : null);

    let renderSymbolOnA = true;
    let renderSymbolOnB = false;
    let openingKind: string | null = null;

    if (isPassageConnect) {
      const otherType = passageRoomType;

      if (otherType === "hall" || otherType === "room") {
        renderSymbolOnA = false;
        renderSymbolOnB = false;
        openingKind = "PASSAGE_OPENING";
      } else if (otherType === "bedroom" || otherType === "master-bedroom") {
        openingKind = "PASSAGE_DOOR_TO_BEDROOM";
        if (ta === "passage") {
          renderSymbolOnA = false;
          renderSymbolOnB = true;
        } else {
          renderSymbolOnA = true;
          renderSymbolOnB = false;
        }
      } else if (otherType === "bathroom") {
        openingKind = "PASSAGE_DOOR_TO_BATHROOM";
        if (ta === "bathroom") {
          renderSymbolOnA = true;
          renderSymbolOnB = false;
        } else {
          renderSymbolOnA = false;
          renderSymbolOnB = true;
        }
      } else if (otherType === "kitchen" || otherType === "dining") {
        renderSymbolOnA = false;
        renderSymbolOnB = false;
        openingKind = "KITCHEN_OPEN_ARCH";
      } else if (otherType === "stairs") {
        renderSymbolOnA = false;
        renderSymbolOnB = false;
        openingKind = "PASSAGE_TO_STAIR_OPENING";
      } else {
        renderSymbolOnA = false;
        renderSymbolOnB = false;
        openingKind = "PASSAGE_OPENING";
      }
    } else if (isBathroom) {
      // ============================================================
      // FIX: Attached Toilet door — MUST renderSymbol = true
      // ============================================================
      const isAttachedA = isAttachedToilet(roomA);
      const isAttachedB = isAttachedToilet(roomB);

      if (ta === "bathroom") {
        renderSymbolOnA = true;
        renderSymbolOnB = false;
        if (isAttachedA) openingKind = "ATTACHED_TOILET_DOOR";
      } else {
        renderSymbolOnA = false;
        renderSymbolOnB = true;
        if (isAttachedB) openingKind = "ATTACHED_TOILET_DOOR";
      }
    } else if (isKitchenHall) {
      renderSymbolOnA = false;
      renderSymbolOnB = false;
      openingKind = "KITCHEN_OPEN_ARCH";
    } else if (isAttachedToilet(roomA) || isAttachedToilet(roomB)) {
      if (isAttachedToilet(roomA)) {
        renderSymbolOnA = true;
        renderSymbolOnB = false;
      } else {
        renderSymbolOnA = false;
        renderSymbolOnB = true;
      }
      openingKind = "ATTACHED_TOILET_DOOR";
    }

    addDoor(roomA, edge.boundary.wallForA, localOffset(edge.boundary, width, roomA, ta), width, openingDoorType, `shared-${sharedId}`, renderSymbolOnA);
    addDoor(roomB, edge.boundary.wallForB, localOffset(edge.boundary, width, roomB, tb), width, openingDoorType, `shared-${sharedId}`, renderSymbolOnB);

    for (const rr of [roomA, roomB]) {
      const dd = (rr.doors || []).find((d: any) => d.id === `shared-${sharedId}`);
      if (dd) {
        if (openingKind) {
          (dd as any).openingKind = openingKind;
        }
        if (ta === normalizeType(rr) && renderSymbolOnA === false) {
          (dd as any).renderSymbol = false;
        }
        if (tb === normalizeType(rr) && renderSymbolOnB === false) {
          (dd as any).renderSymbol = false;
        }
      }
    }

    connected.add(edge.a);
    connected.add(edge.b);
    usedEdges.add(`${Math.min(edge.a, edge.b)}-${Math.max(edge.a, edge.b)}`);
  }

  // ============================================================
  // MAIN ENTRY GATE (bottom parking gate) — CORNER AWARE
  // ============================================================
  const bottomParking = updated
    .filter((r) => is(r, "parking"))
    .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];

  if (bottomParking) {
    const isNarrowPlot = W <= 20.5;
    const gateWidth = isNarrowPlot
      ? Math.min(6.5, Math.max(5.0, bottomParking.w * 0.55))
      : Math.min(8.0, Math.max(6.5, bottomParking.w * 0.65));

    // Narrow plot → corner (right); Wide plot → center
    const offset = isNarrowPlot
      ? Math.max(0.5, bottomParking.w - gateWidth - 0.5)
      : Math.max(0.5, (bottomParking.w - gateWidth) / 2);

    addDoor(bottomParking, "BOTTOM", offset, gateWidth, "MAIN", "d-parking-main-gate", true, isNarrowPlot ? 1 : 2);
    const gate = (bottomParking.doors || []).find((d: any) => d.id === "d-parking-main-gate") as any;
    if (gate) {
      gate.isExternalOpening = true;
      gate.cutsExternalWall = true;
      gate.entryRole = "MAIN_ROAD_VEHICLE_GATE";
      gate.entryStrategy = "ROAD → PARKING → LIVING";
      gate.swingDirection = "INWARDS";
    }
  }

  // ============================================================
  // WINDOW & MOS VALIDATION
  // ============================================================
  const leftMos = setbacks?.left ?? 0;
  const rightMos = setbacks?.right ?? 0;
  const frontMos = setbacks?.front ?? 0;
  const backMos = setbacks?.back ?? 0;

  updated.forEach((room, index) => {
    const type = normalizeType(room);
    const ext = exteriorWallForRoom(room, W, H);
    if (!ext || type === "parking" || type === "stairs" || type === "duct") return;

    let hasValidMos = true;
    if (ext === "LEFT" && leftMos <= 0) hasValidMos = false;
    if (ext === "RIGHT" && rightMos <= 0) hasValidMos = false;
    if (ext === "TOP" && backMos <= 0) hasValidMos = false;
    if (ext === "BOTTOM" && frontMos <= 0) hasValidMos = false;

    if (!hasValidMos) return;

    const horizontal = ext === "TOP" || ext === "BOTTOM";
    const span = horizontal ? room.w : room.h;
    const desired = type === "bathroom" ? Math.min(2, span * 0.5) : Math.min(4, span * 0.65);
    const offset = Math.max(0.5, (span - desired) / 2);

    addWindow(room, ext, offset, desired, type === "bathroom" ? "VENTILATOR" : "STANDARD", `${type === "bathroom" ? "vent" : "win"}-${index}`);
  });

  return updated;
}