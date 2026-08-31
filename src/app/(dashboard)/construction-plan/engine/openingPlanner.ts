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

const TOLERANCE = 0.08;
const EXT_TOLERANCE = 0.5; // Outer boundary tolerance for main gate detection
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

function localOffset(boundary: SharedBoundary, side: "A" | "B", width: number, room: RoomLayout): number {
  const vertical = boundary.wallForA === "LEFT" || boundary.wallForA === "RIGHT";
  const start = boundary.overlapStart;
  const end = boundary.overlapEnd;
  const center = (start + end) / 2;
  const centerStart = center - width / 2;
  const roomStart = vertical ? room.y : room.x;
  void side;
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

  const leafCount = leaves > 1 || width >= 4.0 || doorType === "MAIN" ? 2 : 1;

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
      ...(renderSymbol ? {} : { renderSymbol: false }), 
      ...(id.startsWith('shared-') ? { sharedOpeningId: id } : {}) 
    } as any);
  }
}

function addWindow(room: RoomLayout, wall: PlacedWindow["wall"], offsetFeet: number, lengthFeet: number, windowType: PlacedWindow["windowType"], id: string) {
  room.windows = room.windows || [];
  const max = wall === "LEFT" || wall === "RIGHT" ? room.h : room.w;
  const length = Math.min(lengthFeet, Math.max(2, max - 1.0));
  const offset = Math.max(0.5, Math.min(offsetFeet, Math.max(0.5, max - length - 0.5)));
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

/** Builds a connected circulation graph from actual shared boundaries. */
export function generateFloorOpenings(rooms: RoomLayout[], _roadOrientation: "NORTH" | "SOUTH" | "EAST" | "WEST" = "SOUTH", floorW?: number, floorH?: number): RoomLayout[] {
  const updated = rooms.map((r) => ({ ...r, doors: [...(r.doors || [])], windows: [...(r.windows || [])] }));
  const W = Number(floorW || Math.max(...updated.map((r) => r.x + r.w), 0));
  const H = Number(floorH || Math.max(...updated.map((r) => r.y + r.h), 0));

  const is = (room: RoomLayout, type: string) => normalizeType(room) === type;
  const isWet = (room: RoomLayout) => is(room, "bathroom");
  const isService = (room: RoomLayout) => ["kitchen", "dining", "bathroom", "stairs", "study", "utility", "store"].includes(normalizeType(room));
  
  const canConnect = (a: RoomLayout, b: RoomLayout) => {
    const ta = normalizeType(a);
    const tb = normalizeType(b);

    if (ta === "duct" || tb === "duct") return false;
    if (ta === "bathroom" && tb === "bathroom") return false;
    if (ta === "parking" && tb === "parking") return false;

    // Strict Rule: Parking MUST ONLY connect to Living Room/Hall (Never directly to Kitchen, Bedroom, Pooja, etc.)
    if (ta === "parking" && tb !== "hall") return false;
    if (tb === "parking" && ta !== "hall") return false;

    // Bedrooms should not be connected directly to another bedroom.
    // They must connect through the public/circulation network so a private
    // room never becomes the accidental passage to another private room.
    const privateTypes = ["bedroom", "master-bedroom"];
    if (privateTypes.includes(ta) && privateTypes.includes(tb)) return false;

    // Attached bathroom access is allowed to its own master bedroom, but a
    // bathroom must not become a through-route between unrelated rooms.
    if (ta === "bathroom" && tb === "bathroom") return false;

    return true;
  };

  const adjacency: { a: number; b: number; boundary: SharedBoundary; score: number }[] = [];
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      if (!canConnect(updated[i], updated[j])) continue;
      const boundary = findSharedBoundary(updated[i], i, updated[j], j);
      if (!boundary) continue;
      const ta = normalizeType(updated[i]);
      const tb = normalizeType(updated[j]);
      let score = boundary.length;

      // Circulation Priorities
      if ((ta === "parking" && tb === "hall") || (ta === "hall" && tb === "parking")) score += 1000;
      if ((ta === "hall" && tb === "stairs") || (ta === "stairs" && tb === "hall")) score += 700;
      if ((ta === "hall" && ["pooja", "study"].includes(tb)) || (tb === "hall" && ["pooja", "study"].includes(ta))) score += 680;
      if ((ta === "hall" && ["kitchen", "dining"].includes(tb)) || (tb === "hall" && ["kitchen", "dining"].includes(ta))) score += 620;
      if ((ta === "hall" && ["bedroom", "master-bedroom"].includes(tb)) || (tb === "hall" && ["bedroom", "master-bedroom"].includes(ta))) score += 580;
      if ((ta === "stairs" && (tb === "hall")) || (tb === "stairs" && (ta === "hall"))) score += 760;
      if ((ta === "stairs" && (isWet(updated[j]) || ["bedroom", "master-bedroom"].includes(tb))) || (tb === "stairs" && (isWet(updated[i]) || ["bedroom", "master-bedroom"].includes(ta)))) score += 120;
      if ((ta === "hall" && ["bedroom", "master-bedroom"].includes(tb)) || (tb === "hall" && ["bedroom", "master-bedroom"].includes(ta))) score += 600;
      if ((ta === "hall" && tb === "bathroom") || (tb === "hall" && ta === "bathroom")) score += 560;
      if (isService(updated[i]) && isService(updated[j])) score -= 100;

      adjacency.push({ a: i, b: j, boundary, score });
    }
  }

  const rootParking = updated.findIndex((r) => is(r, "parking"));
  const rootHall = updated.findIndex((r) => is(r, "hall"));
  const root = rootHall >= 0 ? rootHall : (rootParking >= 0 ? rootParking : 0);
  const connected = new Set<number>([root]);
  const usedEdges = new Set<string>();

  // Ensure Parking to Living Room door connection
  if (rootParking >= 0 && rootHall >= 0) {
    const idxEdge = adjacency.findIndex((e) => (e.a === rootParking && e.b === rootHall) || (e.a === rootHall && e.b === rootParking));
    if (idxEdge >= 0) {
      const edge = adjacency[idxEdge];
      const a = updated[edge.a];
      const b = updated[edge.b];
      const width = 3.5;
      const sharedId = `shared-parking-hall-${edge.a}-${edge.b}`;
      addDoor(a, edge.boundary.wallForA, localOffset(edge.boundary, "A", width, a), width, "INTERNAL", `shared-${sharedId}`, true);
      addDoor(b, edge.boundary.wallForB, localOffset(edge.boundary, "B", width, b), width, "INTERNAL", `shared-${sharedId}`, false);
      connected.add(rootParking); connected.add(rootHall);
      usedEdges.add(`${Math.min(edge.a, edge.b)}-${Math.max(edge.a, edge.b)}`);
    }
  }

  // Connect remaining room graph safely
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
    const width = isBathroom ? 2.5 : isPooja ? 2.5 : 3.0;
    
    // For Pooja & Study Room: ensure door opens towards Living Room inner wall only (TOP or LEFT)
    if (isPooja && (edge.boundary.wallForA === "BOTTOM" || edge.boundary.wallForB === "BOTTOM")) {
      usedEdges.add(`${Math.min(edge.a, edge.b)}-${Math.max(edge.a, edge.b)}`);
      continue;
    }

    const sharedId = `shared-${edge.a}-${edge.b}`;
    addDoor(roomA, edge.boundary.wallForA, localOffset(edge.boundary, "A", width, roomA), width, isBathroom ? "BATHROOM" : "INTERNAL", `shared-${sharedId}`, true);
    addDoor(roomB, edge.boundary.wallForB, localOffset(edge.boundary, "B", width, roomB), width, isBathroom ? "BATHROOM" : "INTERNAL", `shared-${sharedId}`, false);
    connected.add(edge.a);
    connected.add(edge.b);
    usedEdges.add(`${Math.min(edge.a, edge.b)}-${Math.max(edge.a, edge.b)}`);
  }

  // --- MAIN ENTRY GATE LOGIC (Force 2 Swing / Double Leaf Gate on Bottom Boundary) ---
  const bottomParking = updated
    .filter((r) => is(r, "parking"))
    .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];

  if (bottomParking) {
    const gateWidth = Math.min(8.0, Math.max(6.0, bottomParking.w * 0.75));
    const offset = Math.max(0.5, (bottomParking.w - gateWidth) / 2);
    // leaves = 2 renders a 2-panel double swing arc on main entrance
    addDoor(bottomParking, "BOTTOM", offset, gateWidth, "MAIN", "d-parking-main-gate", true, 2);
  } else if (rootHall >= 0) {
    const h = updated[rootHall];
    const mainWidth = 5.0;
    const offset = Math.max(0.5, (h.w - mainWidth) / 2);
    addDoor(h, "BOTTOM", offset, mainWidth, "MAIN", "d-main-road-gate", true, 2);
  }

  // Exterior Window/Ventilator Logic
  updated.forEach((room, index) => {
    const type = normalizeType(room);
    const ext = exteriorWallForRoom(room, W, H);
    if (!ext || type === "parking" || type === "stairs" || type === "duct") return;
    const horizontal = ext === "TOP" || ext === "BOTTOM";
    const span = horizontal ? room.w : room.h;
    const desired = type === "bathroom" ? Math.min(2, span * 0.5) : Math.min(4, span * 0.65);
    const offset = Math.max(0.5, (span - desired) / 2);
    addWindow(room, ext, offset, desired, type === "bathroom" ? "VENTILATOR" : "STANDARD", `${type === "bathroom" ? "vent" : "win"}-${index}`);
  });

  return updated;
}