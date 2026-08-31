/* =========================================================
CONSTRUCTION PLAN SYSTEM — CAD GEOMETRY ENGINE
---------------------------------------------------------
Handles geometric calculations, wall offsets, and coordinate transforms.
========================================================= */

import { BlueprintRoom, StructuralColumn, WallSegment } from "./cadTypes";

export type Point2D = {
  x: number;
  y: number;
};

export type LineSegment = {
  start: Point2D;
  end: Point2D;
};

export function calculateWallOffset(point: Point2D, offsetDistance: number): Point2D {
  return {
    x: point.x + offsetDistance,
    y: point.y + offsetDistance,
  };
}

export function computeBoundingBox(points: Point2D[]) {
  if (!points || points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return { minX, minY, maxX, maxY };
}

/**
 * Controls Hatching: Only OTS, DUCT, SHAFT, or OPEN TERRACE get diagonal hatching.
 */
export function shouldRenderHatch(roomName: string, roomType?: string): boolean {
  const name = String(roomName || '').toUpperCase();
  const type = String(roomType || '').toLowerCase();

  return (
    name.includes('OTS') ||
    name.includes('DUCT') ||
    name.includes('SHAFT') ||
    name.includes('OPEN TERRACE') ||
    type === 'duct'
  );
}

// ============================================================================
// ARCHITECTURAL STRUCTURAL GEOMETRY GENERATORS
// ============================================================================

/**
 * Generates 9-inch outer load-bearing walls and 4.5-inch inner partition walls from room coordinates.
 * Includes segment deduplication to eliminate duplicate overlapping lines on shared walls.
 */
export function generateWallsFromRooms(
  rooms: BlueprintRoom[],
  plotWidth: number,
  plotDepth: number
): WallSegment[] {
  if (!rooms || rooms.length === 0) return [];

  const EPS = 0.05;

  const minRoomX = rooms.reduce((m, r) => Math.min(m, r.x), Number.POSITIVE_INFINITY);
  const minRoomY = rooms.reduce((m, r) => Math.min(m, r.y), Number.POSITIVE_INFINITY);
  const maxRoomX = rooms.reduce((m, r) => Math.max(m, r.x + r.w), Number.NEGATIVE_INFINITY);
  const maxRoomY = rooms.reduce((m, r) => Math.max(m, r.y + r.h), Number.NEGATIVE_INFINITY);

  const rawWalls: {
    start: Point2D;
    end: Point2D;
    isOuter: boolean;
    roomId: string;
  }[] = [];

  rooms.forEach((room) => {
    const { x, y, w, h, id } = room;

    const roomSegments = [
      { start: { x, y }, end: { x: x + w, y } },               // Top Wall Segment
      { start: { x: x + w, y }, end: { x: x + w, y: y + h } },   // Right Wall Segment
      { start: { x: x + w, y: y + h }, end: { x, y: y + h } },   // Bottom Wall Segment
      { start: { x, y: y + h }, end: { x, y } },               // Left Wall Segment
    ];

    roomSegments.forEach((seg) => {
      const isOuter =
        (Math.abs(seg.start.y - seg.end.y) < EPS && (Math.abs(seg.start.y - minRoomY) < EPS || Math.abs(seg.start.y - maxRoomY) < EPS)) ||
        (Math.abs(seg.start.x - seg.end.x) < EPS && (Math.abs(seg.start.x - minRoomX) < EPS || Math.abs(seg.start.x - maxRoomX) < EPS));

      rawWalls.push({
        start: seg.start,
        end: seg.end,
        isOuter,
        roomId: id,
      });
    });
  });

  // Deduplicate overlapping wall segments
  const deduplicatedWalls: WallSegment[] = [];
  let wallIdCounter = 1;

  rawWalls.forEach((raw) => {
    const rxMin = Math.min(raw.start.x, raw.end.x);
    const rxMax = Math.max(raw.start.x, raw.end.x);
    const ryMin = Math.min(raw.start.y, raw.end.y);
    const ryMax = Math.max(raw.start.y, raw.end.y);
    const isHorizontal = Math.abs(ryMin - ryMax) < EPS;

    const existing = deduplicatedWalls.find((existingWall) => {
      const exMin = Math.min(existingWall.start.x, existingWall.end.x);
      const exMax = Math.max(existingWall.start.x, existingWall.end.x);
      const eyMin = Math.min(existingWall.start.y, existingWall.end.y);
      const eyMax = Math.max(existingWall.start.y, existingWall.end.y);

      if (isHorizontal) {
        const sameY = Math.abs(ryMin - eyMin) < EPS && Math.abs(ryMax - eyMax) < EPS;
        const overlapX = Math.max(rxMin, exMin) < Math.min(rxMax, exMax) - EPS;
        return sameY && overlapX;
      } else {
        const sameX = Math.abs(rxMin - exMin) < EPS && Math.abs(rxMax - exMax) < EPS;
        const overlapY = Math.max(ryMin, eyMin) < Math.min(ryMax, eyMax) - EPS;
        return sameX && overlapY;
      }
    });

    if (existing) {
      if (!existing.associatedRoomIds.includes(raw.roomId)) {
        existing.associatedRoomIds.push(raw.roomId);
      }
      if (raw.isOuter) {
        existing.isOuter = true;
        existing.thickness = 9;
      }
    } else {
      deduplicatedWalls.push({
        id: `wall_${wallIdCounter++}`,
        start: raw.start,
        end: raw.end,
        thickness: raw.isOuter ? 9 : 4.5,
        isOuter: raw.isOuter,
        associatedRoomIds: [raw.roomId],
      });
    }
  });

  return deduplicatedWalls;
}

/**
 * Generates RCC Structural Columns (9" x 12") at room corner intersections.
 */
export function generateStructuralColumns(rooms: BlueprintRoom[]): StructuralColumn[] {
  const columns: StructuralColumn[] = [];
  const columnSet = new Set<string>();
  let colIdCounter = 1;

  rooms.forEach((room) => {
    const corners: Point2D[] = [
      { x: room.x, y: room.y },
      { x: room.x + room.w, y: room.y },
      { x: room.x + room.w, y: room.y + room.h },
      { x: room.x, y: room.y + room.h },
    ];

    corners.forEach((pt) => {
      const key = `${pt.x.toFixed(2)}_${pt.y.toFixed(2)}`;
      if (!columnSet.has(key)) {
        columnSet.add(key);
        columns.push({
          id: `col_${colIdCounter++}`,
          x: pt.x,
          y: pt.y,
          width: 0.75, // 9 inches in feet (0.75 FT)
          depth: 1.0,  // 12 inches in feet (1.0 FT)
          rotation: 0,
        });
      }
    });
  });

  return columns;
}